#include <catch2/catch_test_macros.hpp>

#include <string>

#include "ctf/Exceptions.hpp"
#include "ctf/app/CTFManager.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;

namespace {
ChallengeSpec withWriteup(const std::string& id, std::optional<std::string> writeup) {
    ChallengeSpec s;
    s.id = id;
    s.title = id;
    s.basePoints = 100;
    s.scoring = ScoringKind::Static;
    s.flagType = FlagType::Static;
    s.flag = "CTF{" + id + "}";
    s.writeup = std::move(writeup);
    return s;
}

events::AntiCheatConfig quiet() {
    events::AntiCheatConfig c;
    c.fastSolveEasySeconds = c.fastSolveMediumSeconds = c.fastSolveHardSeconds = 0;
    c.correlationMinChallenges = 0;
    return c;
}
}  // namespace

TEST_CASE("A writeup is hidden until the team solves the challenge", "[app][manager][writeup]") {
    CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    auto bob = mgr.registerUser("bob", "bob@x.com", "password123");
    mgr.createTeam(alice.me.id, "Alpha");
    mgr.createTeam(bob.me.id, "Bravo");
    mgr.setAntiCheatConfig(admin.me.id, quiet());
    mgr.createChallenge(admin.me.id, withWriteup("c_1", "## How it works\nXOR twice."));
    mgr.createChallenge(admin.me.id, withWriteup("c_2", std::nullopt));  // no writeup
    mgr.startEvent(admin.me.id);

    SECTION("before solving: the player learns one exists but cannot read it") {
        const auto d = mgr.challengeDetail(alice.me.id, "c_1");
        REQUIRE(d.hasWriteup);
        REQUIRE_FALSE(d.writeup.has_value());
    }

    SECTION("after solving: that team (and only that team) can read it") {
        REQUIRE(mgr.submitFlag(alice.me.id, "c_1", "CTF{c_1}").result == SubmitResult::Correct);
        const auto mine = mgr.challengeDetail(alice.me.id, "c_1");
        REQUIRE(mine.writeup.has_value());
        REQUIRE(*mine.writeup == "## How it works\nXOR twice.");
        REQUIRE_FALSE(mgr.challengeDetail(bob.me.id, "c_1").writeup.has_value());  // Bravo has not solved it
    }

    SECTION("a challenge with no writeup reports none") {
        const auto d = mgr.challengeDetail(alice.me.id, "c_2");
        REQUIRE_FALSE(d.hasWriteup);
        REQUIRE_FALSE(d.writeup.has_value());
    }

    SECTION("admins always see it") {
        REQUIRE(mgr.challengeDetail(admin.me.id, "c_1").writeup.has_value());
    }

    SECTION("everyone sees it once the event has ended") {
        mgr.endEvent(admin.me.id);
        REQUIRE(mgr.challengeDetail(bob.me.id, "c_1").writeup.has_value());
    }
}

TEST_CASE("Editing a challenge without a writeup keeps it; an empty one clears it", "[app][manager][writeup]") {
    const std::string dir = ctftest::makeTempDir();
    {
        CTFManager mgr("test-secret", dir, std::make_unique<ctftest::FakeClock>());
        auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
        mgr.createChallenge(admin.me.id, withWriteup("c_1", "original"));

        mgr.editChallenge(admin.me.id, "c_1", withWriteup("c_1", std::nullopt));  // not sent: kept
        REQUIRE(*mgr.challengeDetail(admin.me.id, "c_1").writeup == "original");

        mgr.editChallenge(admin.me.id, "c_1", withWriteup("c_1", "updated"));
        REQUIRE(*mgr.challengeDetail(admin.me.id, "c_1").writeup == "updated");
    }

    // survives a restart
    CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto admin = reloaded.login("admin", "password123");
    REQUIRE(*reloaded.challengeDetail(admin.me.id, "c_1").writeup == "updated");

    reloaded.editChallenge(admin.me.id, "c_1", withWriteup("c_1", ""));  // explicit empty clears
    REQUIRE_FALSE(reloaded.challengeDetail(admin.me.id, "c_1").hasWriteup);
}

TEST_CASE("An oversized writeup is rejected", "[app][manager][writeup]") {
    CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    REQUIRE_THROWS_AS(mgr.createChallenge(admin.me.id, withWriteup("c_1", std::string(20001, 'x'))),
                      ValidationException);
}
