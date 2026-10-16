#include <catch2/catch_test_macros.hpp>

#include <string>

#include "ctf/Exceptions.hpp"
#include "ctf/app/CTFManager.hpp"
#include "ctf/core/Crypto.hpp"
#include "ctf/core/FileTransform.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;

TEST_CASE("Transform pipelines are validated", "[core][transform]") {
    REQUIRE(isValidTransform(""));
    REQUIRE(isValidTransform("none"));
    REQUIRE(isValidTransform("flag|xor|hex"));
    REQUIRE_FALSE(isValidTransform("flag|rot13"));
    REQUIRE_FALSE(isValidTransform("xor||hex"));
    REQUIRE_FALSE(isPersonalising("none"));
    REQUIRE(isPersonalising("hex"));
    REQUIRE(transformNeedsFlag("flag|hex"));
    REQUIRE_FALSE(transformNeedsFlag("xor|hex"));
    REQUIRE_THROWS_AS(applyTransform("bogus", "x", {}), ValidationException);
}

TEST_CASE("Transform operations match known vectors", "[core][transform]") {
    TransformContext ctx;
    ctx.teamFlag = "CTF{abc}";
    ctx.xorKey = 0x20;

    REQUIRE(applyTransform("none", "keep", ctx) == "keep");
    REQUIRE(applyTransform("flag", "x={{FLAG}};y={{FLAG}}", ctx) == "x=CTF{abc};y=CTF{abc}");
    REQUIRE(applyTransform("hex", "AB", ctx) == "4142");
    // RFC 4648 test vectors
    REQUIRE(applyTransform("base64", "foobar", ctx) == "Zm9vYmFy");
    REQUIRE(applyTransform("base64", "fooba", ctx) == "Zm9vYmE=");
    REQUIRE(applyTransform("base64", "foob", ctx) == "Zm9vYg==");
    REQUIRE(applyTransform("base64", "", ctx).empty());
    // XOR with 0x20 flips ASCII case, and applying it twice restores the input
    REQUIRE(applyTransform("xor", "Hi", ctx) == "hI");
    REQUIRE(applyTransform("xor|xor", "Hi", ctx) == "Hi");
}

TEST_CASE("The XOR key is per team, per challenge and never zero", "[core][transform]") {
    const auto a = deriveXorKey("secret", "c_1", "t_1");
    REQUIRE(a == deriveXorKey("secret", "c_1", "t_1"));  // deterministic
    int differing = 0;
    for (int t = 1; t <= 40; ++t) {
        const auto k = deriveXorKey("secret", "c_1", "t_" + std::to_string(t));
        REQUIRE(k != 0);
        if (k != a) ++differing;
    }
    REQUIRE(differing > 20);  // teams really do get different keys
    REQUIRE(deriveXorKey("secret", "c_1", "t_1") != 0);
}

namespace {
ChallengeSpec dynamicChallenge(const std::string& id) {
    ChallengeSpec s;
    s.id = id;
    s.title = id;
    s.basePoints = 100;
    s.scoring = ScoringKind::DynamicScore;
    s.flagType = FlagType::Dynamic;
    s.flagPrefix = "CTF";
    return s;
}
}  // namespace

TEST_CASE("Each team receives a different file, solvable with its own flag", "[app][manager][transform]") {
    CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    auto bob = mgr.registerUser("bob", "bob@x.com", "password123");
    auto teamA = mgr.createTeam(alice.me.id, "Alpha");
    auto teamB = mgr.createTeam(bob.me.id, "Bravo");
    mgr.createChallenge(admin.me.id, dynamicChallenge("c_1"));

    const std::string tmpl = "operator note: the access code is {{FLAG}} - do not share";
    const auto info = mgr.addAttachment(admin.me.id, "c_1", "note.hex", tmpl, "flag|xor|hex");
    REQUIRE(info.personalised);
    mgr.startEvent(admin.me.id);

    const auto fa = mgr.downloadAttachment(alice.me.id, "c_1", "note.hex");
    const auto fb = mgr.downloadAttachment(bob.me.id, "c_1", "note.hex");
    REQUIRE(fa.bytes != fb.bytes);  // different files per team
    REQUIRE(fa.bytes.find("CTF{") == std::string::npos);  // the flag is not readable as-is

    // A solver brute-forces the single-byte key and recovers THEIR team's flag.
    auto crack = [](const std::string& hex) {
        std::string raw;
        for (std::size_t i = 0; i + 1 < hex.size(); i += 2) {
            raw.push_back(static_cast<char>(std::stoi(hex.substr(i, 2), nullptr, 16)));
        }
        for (int key = 1; key < 256; ++key) {
            std::string attempt = raw;
            for (char& c : attempt) c = static_cast<char>(static_cast<unsigned char>(c) ^ key);
            const auto pos = attempt.find("CTF{");
            if (pos != std::string::npos) return attempt.substr(pos, attempt.find('}', pos) - pos + 1);
        }
        return std::string();
    };
    const std::string flagA = crack(fa.bytes);
    const std::string flagB = crack(fb.bytes);
    REQUIRE(flagA == mgr.revealTeamFlag(admin.me.id, teamA.id, "c_1"));
    REQUIRE(flagB == mgr.revealTeamFlag(admin.me.id, teamB.id, "c_1"));
    REQUIRE(flagA != flagB);
    REQUIRE(mgr.submitFlag(alice.me.id, "c_1", flagA).result == SubmitResult::Correct);
    // Submitting the other team's recovered flag is detected as sharing.
    auto carol = mgr.registerUser("carol", "carol@x.com", "password123");
    mgr.createTeam(carol.me.id, "Charlie");
    REQUIRE(mgr.submitFlag(carol.me.id, "c_1", flagA).result == SubmitResult::FlagSharing);

    SECTION("the detail view shows the hash of the team's own copy") {
        const auto d = mgr.challengeDetail(alice.me.id, "c_1");
        REQUIRE(d.attachments.size() == 1);
        REQUIRE(d.attachments[0].personalised);
        REQUIRE(d.attachments[0].sha256 == crypto::sha256Hex(fa.bytes));
        REQUIRE(d.attachments[0].size == fa.bytes.size());
    }
    SECTION("admins receive the stored template") {
        REQUIRE(mgr.downloadAttachment(admin.me.id, "c_1", "note.hex").bytes == tmpl);
    }
}

TEST_CASE("Personalised files need a team and a matching challenge type", "[app][manager][transform]") {
    CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto drifter = mgr.registerUser("drifter", "d@x.com", "password123");  // no team
    mgr.createChallenge(admin.me.id, dynamicChallenge("c_1"));

    ChallengeSpec stat;
    stat.id = "c_2";
    stat.title = "static";
    stat.basePoints = 100;
    stat.scoring = ScoringKind::Static;
    stat.flagType = FlagType::Static;
    stat.flag = "CTF{x}";
    mgr.createChallenge(admin.me.id, stat);

    // the 'flag' op only makes sense when the challenge has per-team flags
    REQUIRE_THROWS_AS(mgr.addAttachment(admin.me.id, "c_2", "a.txt", "{{FLAG}}", "flag"), ValidationException);
    REQUIRE_NOTHROW(mgr.addAttachment(admin.me.id, "c_2", "b.txt", "data", "xor|hex"));  // fine without a flag
    REQUIRE_THROWS_AS(mgr.addAttachment(admin.me.id, "c_1", "a.txt", "x", "nonsense"), ValidationException);

    mgr.addAttachment(admin.me.id, "c_1", "n.txt", "{{FLAG}}", "flag");
    mgr.startEvent(admin.me.id);
    REQUIRE_THROWS_AS(mgr.downloadAttachment(drifter.me.id, "c_1", "n.txt"), PermissionException);

    // replacing the bytes without naming a transform keeps the existing personalisation
    mgr.addAttachment(admin.me.id, "c_1", "n.txt", "new {{FLAG}}");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    auto team = mgr.createTeam(alice.me.id, "Alpha");
    const auto f = mgr.downloadAttachment(alice.me.id, "c_1", "n.txt");
    REQUIRE(f.bytes == "new " + mgr.revealTeamFlag(admin.me.id, team.id, "c_1"));
}
