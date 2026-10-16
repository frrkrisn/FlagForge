#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "ctf/Exceptions.hpp"
#include "ctf/app/CTFManager.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;
using namespace std::chrono;

namespace {

/// Behavioural anti-cheat rules off (a fake clock makes every solve instant, which they would flag).
events::AntiCheatConfig quietAntiCheat() {
    events::AntiCheatConfig c;
    c.fastSolveEasySeconds = c.fastSolveMediumSeconds = c.fastSolveHardSeconds = 0;
    c.correlationMinChallenges = 0;
    return c;
}

struct Harness {
    std::string dir;
    ctftest::FakeClock* clock;
    std::unique_ptr<CTFManager> mgr;
};

Harness makeHarness() {
    auto clock = std::make_unique<ctftest::FakeClock>();
    auto* raw = clock.get();
    std::string dir = ctftest::makeTempDir();
    auto mgr = std::make_unique<CTFManager>("test-secret", dir, std::move(clock));
    return Harness{std::move(dir), raw, std::move(mgr)};
}

ChallengeSpec staticSpec(const std::string& id, const std::string& flag, int base,
                         std::vector<ChallengeId> prereqs = {},
                         ScoringKind scoring = ScoringKind::Decay) {
    ChallengeSpec s;
    s.id = id;
    s.title = id;
    s.basePoints = base;
    s.minPoints = base / 5;
    s.decay = 10;
    s.scoring = scoring;
    s.flagType = FlagType::Static;
    s.flag = flag;
    s.prerequisites = std::move(prereqs);
    return s;
}

}  // namespace

TEST_CASE("Full submit-flag scenario matrix", "[app][manager]") {
    auto h = makeHarness();
    CTFManager& mgr = *h.mgr;

    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    auto bob = mgr.registerUser("bob", "bob@x.com", "password123");
    REQUIRE(admin.me.role == Role::Admin);
    REQUIRE(alice.me.role == Role::Player);

    auto teamA = mgr.createTeam(alice.me.id, "Alpha");
    auto teamB = mgr.createTeam(bob.me.id, "Bravo");

    mgr.createChallenge(admin.me.id,
                        staticSpec("c_1", "CTF{one}", 100, {}, ScoringKind::DecayFirstBlood));
    mgr.createChallenge(admin.me.id, staticSpec("c_2", "CTF{two}", 200, {"c_1"}));

    SECTION("closed before the event starts") {
        REQUIRE_THROWS_AS(mgr.submitFlag(alice.me.id, "c_1", "CTF{one}"),
                          CompetitionClosedException);
    }

    mgr.startEvent(admin.me.id);

    SECTION("locked until prerequisites are solved") {
        REQUIRE_THROWS_AS(mgr.submitFlag(bob.me.id, "c_2", "CTF{two}"), ChallengeLockedException);
    }

    SECTION("wrong / correct / first-blood / duplicate / decay") {
        auto wrong = mgr.submitFlag(alice.me.id, "c_1", "CTF{nope}");
        REQUIRE(wrong.result == SubmitResult::Wrong);
        REQUIRE(wrong.attemptsLeft.value() == 4);

        auto first = mgr.submitFlag(alice.me.id, "c_1", "CTF{one}");
        REQUIRE(first.result == SubmitResult::Correct);
        REQUIRE(first.firstBlood.value());

        auto second = mgr.submitFlag(bob.me.id, "c_1", "CTF{one}");
        REQUIRE(second.result == SubmitResult::Correct);
        REQUIRE_FALSE(second.firstBlood.value());

        auto dup = mgr.submitFlag(alice.me.id, "c_1", "CTF{one}");
        REQUIRE(dup.result == SubmitResult::AlreadySolved);

        auto chain = mgr.submitFlag(bob.me.id, "c_2", "CTF{two}");  // bob solved c_1, so allowed
        REQUIRE(chain.result == SubmitResult::Correct);

        auto board = mgr.publicScoreboard();
        REQUIRE(board.rows.size() == 2);
        REQUIRE(board.rows[0].teamId == teamB.id);  // Bravo (c1+c2) leads Alpha (c1 + firstblood)
    }

    SECTION("cooldown after repeated wrong attempts") {
        auto carol = mgr.registerUser("carol", "carol@x.com", "password123");
        mgr.createTeam(carol.me.id, "Charlie");
        mgr.createChallenge(admin.me.id, staticSpec("c_3", "CTF{three}", 100));
        for (int i = 0; i < events::CooldownTracker::kMaxWrong; ++i) {
            REQUIRE(mgr.submitFlag(carol.me.id, "c_3", "CTF{bad}").result == SubmitResult::Wrong);
        }
        REQUIRE_THROWS_AS(mgr.submitFlag(carol.me.id, "c_3", "CTF{bad}"), CooldownException);
    }

    SECTION("event ends -> closed") {
        mgr.endEvent(admin.me.id);
        REQUIRE_THROWS_AS(mgr.submitFlag(alice.me.id, "c_1", "CTF{one}"),
                          CompetitionClosedException);
    }
}

TEST_CASE("Dynamic per-team flags and flag-sharing detection", "[app][manager][anticheat]") {
    auto h = makeHarness();
    CTFManager& mgr = *h.mgr;
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    auto bob = mgr.registerUser("bob", "bob@x.com", "password123");
    auto teamA = mgr.createTeam(alice.me.id, "Alpha");
    auto teamB = mgr.createTeam(bob.me.id, "Bravo");
    mgr.setAntiCheatConfig(admin.me.id, quietAntiCheat());  // this test is about flag sharing only

    ChallengeSpec dyn;
    dyn.id = "c_7";
    dyn.title = "Team Token";
    dyn.basePoints = 300;
    dyn.scoring = ScoringKind::DynamicScore;
    dyn.flagType = FlagType::Dynamic;
    dyn.flagPrefix = "CTF";
    mgr.createChallenge(admin.me.id, dyn);
    mgr.startEvent(admin.me.id);

    const std::string aFlag = mgr.revealTeamFlag(admin.me.id, teamA.id, "c_7");
    const std::string bFlag = mgr.revealTeamFlag(admin.me.id, teamB.id, "c_7");
    REQUIRE(aFlag != bFlag);

    // Alice solves with her own flag.
    REQUIRE(mgr.submitFlag(alice.me.id, "c_7", aFlag).result == SubmitResult::Correct);

    // Bob submits Alice's flag -> detected as flag sharing.
    REQUIRE(mgr.submitFlag(bob.me.id, "c_7", aFlag).result == SubmitResult::FlagSharing);
    auto alerts = mgr.alerts(admin.me.id);
    REQUIRE(alerts.size() == 1);
    REQUIRE(alerts[0].kind == events::AlertKind::FlagSharing);
}

TEST_CASE("State persists across a restart", "[app][manager][persistence]") {
    std::string dir;
    std::string topTeamId;
    int topScore = 0;

    {
        auto h = makeHarness();
        dir = h.dir;
        CTFManager& mgr = *h.mgr;
        auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
        auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
        mgr.createTeam(alice.me.id, "Alpha");
        mgr.createChallenge(admin.me.id, staticSpec("c_1", "CTF{one}", 100));
        mgr.startEvent(admin.me.id);
        mgr.submitFlag(alice.me.id, "c_1", "CTF{one}");
        auto board = mgr.publicScoreboard();
        topTeamId = board.rows[0].teamId;
        topScore = board.rows[0].score;
    }

    // Fresh manager, same data dir: load and compare.
    CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto board = reloaded.publicScoreboard();
    REQUIRE(board.rows.size() == 1);
    REQUIRE(board.rows[0].teamId == topTeamId);
    REQUIRE(board.rows[0].score == topScore);
    REQUIRE_NOTHROW(reloaded.login("alice", "password123"));  // password hash survived
}

TEST_CASE("Alerts and the activity feed survive a restart", "[app][manager][persistence]") {
    std::string dir;
    {
        auto h = makeHarness();
        dir = h.dir;
        CTFManager& mgr = *h.mgr;
        auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
        auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
        auto bob = mgr.registerUser("bob", "bob@x.com", "password123");
        auto teamA = mgr.createTeam(alice.me.id, "Alpha");
        mgr.createTeam(bob.me.id, "Bravo");
        mgr.setAntiCheatConfig(admin.me.id, quietAntiCheat());  // only the flag-sharing alert is expected

        ChallengeSpec dyn;
        dyn.id = "c_1";
        dyn.title = "Team Token";
        dyn.basePoints = 300;
        dyn.scoring = ScoringKind::DynamicScore;
        dyn.flagType = FlagType::Dynamic;
        mgr.createChallenge(admin.me.id, dyn);
        mgr.startEvent(admin.me.id);

        // Bob submits Alice's per-team flag: a flag-sharing alert is raised and then dismissed.
        const std::string aliceFlag = mgr.revealTeamFlag(admin.me.id, teamA.id, "c_1");
        REQUIRE(mgr.submitFlag(bob.me.id, "c_1", aliceFlag).result == SubmitResult::FlagSharing);
        auto alerts = mgr.alerts(admin.me.id);
        REQUIRE(alerts.size() == 1);
        mgr.dismissAlert(admin.me.id, alerts[0].id);
    }

    CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto admin = reloaded.login("admin", "password123");

    auto alerts = reloaded.alerts(admin.me.id);
    REQUIRE(alerts.size() == 1);
    REQUIRE(alerts[0].kind == events::AlertKind::FlagSharing);
    REQUIRE(alerts[0].status == events::AlertStatus::Dismissed);  // the dismissal persisted too

    auto feed = reloaded.feedSince(0);
    REQUIRE_FALSE(feed.empty());
    bool sawSharing = false;
    for (const auto& e : feed) sawSharing = sawSharing || e.type == events::EventType::FlagSharing;
    REQUIRE(sawSharing);
}

TEST_CASE("Challenge ids do not collide after a restart", "[app][manager][persistence]") {
    auto spec = [] {
        ChallengeSpec s;
        s.title = "Test";
        s.basePoints = 100;
        s.scoring = ScoringKind::Static;
        s.flagType = FlagType::Static;
        s.flag = "CTF{x}";
        return s;
    };
    std::string dir;
    {
        auto h = makeHarness();
        dir = h.dir;
        auto admin = h.mgr->registerUser("admin", "admin@x.com", "password123");
        REQUIRE(h.mgr->createChallenge(admin.me.id, spec()).id == "c_1");
        REQUIRE(h.mgr->createChallenge(admin.me.id, spec()).id == "c_2");
    }
    CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto admin = reloaded.login("admin", "password123");
    // The next id must continue past the loaded challenges, not reset to c_1.
    REQUIRE(reloaded.createChallenge(admin.me.id, spec()).id == "c_3");
}

TEST_CASE("Concurrent submissions are race-free and pick one first blood",
          "[app][manager][concurrency]") {
    auto h = makeHarness();
    CTFManager& mgr = *h.mgr;
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    mgr.createChallenge(admin.me.id, staticSpec("c_1", "CTF{flag}", 100));
    mgr.startEvent(admin.me.id);

    constexpr int kTeams = 8;
    std::vector<std::string> playerIds;
    for (int i = 0; i < kTeams; ++i) {
        auto p = mgr.registerUser("player" + std::to_string(i),
                                  "p" + std::to_string(i) + "@x.com", "password123");
        mgr.createTeam(p.me.id, "Team" + std::to_string(i));
        playerIds.push_back(p.me.id);
    }

    std::vector<std::thread> threads;
    for (const std::string& pid : playerIds) {
        threads.emplace_back([&mgr, pid] { mgr.submitFlag(pid, "c_1", "CTF{flag}"); });
    }
    for (auto& t : threads) t.join();

    auto correct = mgr.submissions(admin.me.id,
                                   SubmissionFilter{std::nullopt, std::nullopt, SubmitResult::Correct});
    REQUIRE(correct.size() == static_cast<std::size_t>(kTeams));

    int firstBloods = 0;
    for (const auto& e : mgr.feedSince(0)) {
        if (e.type == events::EventType::FirstBlood) ++firstBloods;
    }
    REQUIRE(firstBloods == 1);  // exactly one team can win first blood despite the race
}
