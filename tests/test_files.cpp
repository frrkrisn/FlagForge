#include <catch2/catch_test_macros.hpp>

#include <string>

#include "ctf/Exceptions.hpp"
#include "ctf/app/CTFManager.hpp"
#include "ctf/core/Crypto.hpp"
#include "ctf/persistence/FileStore.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;
using ctf::persistence::FileStore;

TEST_CASE("FileStore round-trips arbitrary binary bytes", "[persistence][filestore]") {
    FileStore store(ctftest::makeTempDir());
    std::string bytes;
    for (int i = 0; i < 256; ++i) bytes.push_back(static_cast<char>(i));  // includes NUL and 0xFF

    store.save("c_1", "blob.bin", bytes);
    REQUIRE(store.exists("c_1", "blob.bin"));
    REQUIRE(store.load("c_1", "blob.bin") == bytes);

    store.save("c_1", "blob.bin", "replaced");  // overwrite
    REQUIRE(store.load("c_1", "blob.bin") == "replaced");

    store.remove("c_1", "blob.bin");
    REQUIRE_FALSE(store.exists("c_1", "blob.bin"));
    REQUIRE_THROWS_AS(store.load("c_1", "blob.bin"), NotFoundException);
}

TEST_CASE("FileStore rejects unsafe names (no path traversal)", "[persistence][filestore]") {
    FileStore store(ctftest::makeTempDir());
    for (const char* bad : {"../evil", "a/b", "a\\b", ".hidden", "", "name with space", "/abs"}) {
        REQUIRE_FALSE(FileStore::isSafeName(bad));
        REQUIRE_THROWS_AS(store.save("c_1", bad, "x"), ValidationException);
    }
    REQUIRE_THROWS_AS(store.save("../scope", "ok.txt", "x"), ValidationException);
    REQUIRE(FileStore::isSafeName("capture.pcap"));
    REQUIRE(FileStore::isSafeName("key_v2-final.txt"));
}

TEST_CASE("FileStore removeScope deletes every file of a challenge", "[persistence][filestore]") {
    FileStore store(ctftest::makeTempDir());
    store.save("c_9", "a.txt", "a");
    store.save("c_9", "b.txt", "b");
    store.removeScope("c_9");
    REQUIRE_FALSE(store.exists("c_9", "a.txt"));
    REQUIRE_FALSE(store.exists("c_9", "b.txt"));
}

namespace {
ChallengeSpec staticChallenge(const std::string& id, std::vector<ChallengeId> prereqs = {}) {
    ChallengeSpec s;
    s.id = id;
    s.title = id;
    s.basePoints = 100;
    s.scoring = ScoringKind::Static;
    s.flagType = FlagType::Static;
    s.flag = "CTF{" + id + "}";
    s.prerequisites = std::move(prereqs);
    return s;
}
}  // namespace

TEST_CASE("Attachments: upload, hash, download and access rules", "[app][manager][files]") {
    auto clock = std::make_unique<ctftest::FakeClock>();
    const std::string dir = ctftest::makeTempDir();
    CTFManager mgr("test-secret", dir, std::move(clock));

    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    mgr.createTeam(alice.me.id, "Alpha");
    mgr.createChallenge(admin.me.id, staticChallenge("c_1"));
    mgr.createChallenge(admin.me.id, staticChallenge("c_2", {"c_1"}));

    const std::string payload("PK\x03\x04\x00\xff binary payload", 24);
    const auto info = mgr.addAttachment(admin.me.id, "c_1", "evidence.bin", payload);
    REQUIRE(info.size == payload.size());
    REQUIRE(info.sha256 == crypto::sha256Hex(payload));  // the hash players can verify

    SECTION("a player cannot download before the event runs") {
        REQUIRE_THROWS_AS(mgr.downloadAttachment(alice.me.id, "c_1", "evidence.bin"),
                          CompetitionClosedException);
    }

    mgr.startEvent(admin.me.id);

    SECTION("a player downloads the exact bytes") {
        const auto f = mgr.downloadAttachment(alice.me.id, "c_1", "evidence.bin");
        REQUIRE(f.bytes == payload);
        REQUIRE(f.name == "evidence.bin");
    }

    SECTION("files of a locked challenge are refused") {
        mgr.addAttachment(admin.me.id, "c_2", "later.txt", "secret");
        REQUIRE_THROWS_AS(mgr.downloadAttachment(alice.me.id, "c_2", "later.txt"),
                          ChallengeLockedException);
        REQUIRE_NOTHROW(mgr.downloadAttachment(admin.me.id, "c_2", "later.txt"));  // admins may
    }

    SECTION("a hidden challenge's files do not exist for players") {
        mgr.setChallengeVisibility(admin.me.id, "c_1", false);
        REQUIRE_THROWS_AS(mgr.downloadAttachment(alice.me.id, "c_1", "evidence.bin"), NotFoundException);
    }

    SECTION("unknown file and non-admin upload") {
        REQUIRE_THROWS_AS(mgr.downloadAttachment(alice.me.id, "c_1", "nope.bin"), NotFoundException);
        REQUIRE_THROWS_AS(mgr.addAttachment(alice.me.id, "c_1", "x.txt", "x"), PermissionException);
    }

    SECTION("detail exposes name, size and hash") {
        const auto d = mgr.challengeDetail(alice.me.id, "c_1");
        REQUIRE(d.attachments.size() == 1);
        REQUIRE(d.attachments[0].sha256 == info.sha256);
    }

    SECTION("editing a challenge keeps its attachments; removing deletes the file") {
        mgr.editChallenge(admin.me.id, "c_1", staticChallenge("c_1"));
        REQUIRE(mgr.challengeDetail(admin.me.id, "c_1").attachments.size() == 1);
        mgr.removeAttachment(admin.me.id, "c_1", "evidence.bin");
        REQUIRE(mgr.challengeDetail(admin.me.id, "c_1").attachments.empty());
        REQUIRE_THROWS_AS(mgr.downloadAttachment(admin.me.id, "c_1", "evidence.bin"), NotFoundException);
    }
}

TEST_CASE("Attachment metadata and bytes survive a restart", "[app][manager][files][persistence]") {
    const std::string dir = ctftest::makeTempDir();
    std::string hash;
    {
        CTFManager mgr("test-secret", dir, std::make_unique<ctftest::FakeClock>());
        auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
        mgr.createChallenge(admin.me.id, staticChallenge("c_1"));
        hash = mgr.addAttachment(admin.me.id, "c_1", "note.txt", "hello world").sha256;
    }
    CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto admin = reloaded.login("admin", "password123");
    const auto d = reloaded.challengeDetail(admin.me.id, "c_1");
    REQUIRE(d.attachments.size() == 1);
    REQUIRE(d.attachments[0].sha256 == hash);
    REQUIRE(reloaded.downloadAttachment(admin.me.id, "c_1", "note.txt").bytes == "hello world");
}
