#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <string>

#include "ctf/Exceptions.hpp"
#include "ctf/app/CTFManager.hpp"
#include "ctf/events/AntiCheatMonitor.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::events;
using namespace std::chrono;

namespace {
SolveObservation solve(const std::string& team, const std::string& challenge, Difficulty d, TimePoint available,
                       TimePoint at) {
    return SolveObservation{team, "Team " + team, challenge, "Challenge " + challenge, d, available, at};
}

std::size_t countKind(const AntiCheatMonitor& m, AlertKind kind) {
    std::size_t n = 0;
    for (const Alert& a : m.alerts()) n += a.kind == kind ? 1 : 0;
    return n;
}
}  // namespace

TEST_CASE("A solve far faster than the challenge allowed is flagged", "[events][anticheat][fast]") {
    AntiCheatMonitor m;
    const TimePoint t0 = Clock::now();

    m.noteSolve(solve("t_1", "c_1", Difficulty::Hard, t0, t0 + seconds(10)));  // 10s < 25s limit
    REQUIRE(countKind(m, AlertKind::FastSolve) == 1);
    REQUIRE(m.alerts()[0].evidence.find("10s") != std::string::npos);
    REQUIRE(m.alerts()[0].teams == std::vector<TeamId>{"t_1"});

    m.noteSolve(solve("t_2", "c_1", Difficulty::Hard, t0, t0 + seconds(120)));  // plenty of time: fine
    REQUIRE(countKind(m, AlertKind::FastSolve) == 1);

    // the limit depends on difficulty: 10s is slow enough for an EASY challenge (limit 3s)
    m.noteSolve(solve("t_3", "c_2", Difficulty::Easy, t0, t0 + seconds(10)));
    REQUIRE(countKind(m, AlertKind::FastSolve) == 1);
    m.noteSolve(solve("t_4", "c_2", Difficulty::Easy, t0, t0 + seconds(1)));
    REQUIRE(countKind(m, AlertKind::FastSolve) == 2);
}

TEST_CASE("A fast-solve rule set to 0 is disabled; alerts are not duplicated", "[events][anticheat][fast]") {
    AntiCheatMonitor m;
    const TimePoint t0 = Clock::now();

    AntiCheatConfig off;
    off.fastSolveEasySeconds = off.fastSolveMediumSeconds = off.fastSolveHardSeconds = 0;
    m.setConfig(off);
    m.noteSolve(solve("t_1", "c_1", Difficulty::Hard, t0, t0 + seconds(1)));
    REQUIRE(countKind(m, AlertKind::FastSolve) == 0);

    m.setConfig(AntiCheatConfig{});
    m.noteSolve(solve("t_1", "c_1", Difficulty::Hard, t0, t0 + seconds(1)));
    m.noteSolve(solve("t_1", "c_1", Difficulty::Hard, t0, t0 + seconds(2)));  // same team + challenge
    REQUIRE(countKind(m, AlertKind::FastSolve) == 1);
}

TEST_CASE("Two teams solving the same challenges together are flagged as correlated", "[events][anticheat][correlation]") {
    AntiCheatMonitor m;
    AntiCheatConfig cfg;
    cfg.fastSolveEasySeconds = cfg.fastSolveMediumSeconds = cfg.fastSolveHardSeconds = 0;  // isolate this rule
    m.setConfig(cfg);                                                                       // window 5s, 3 challenges
    const TimePoint t0 = Clock::now();

    // A and B solve three different challenges within 2s of each other
    for (int i = 1; i <= 3; ++i) {
        const std::string c = "c_" + std::to_string(i);
        const TimePoint at = t0 + seconds(i * 100);
        m.noteSolve(solve("t_a", c, Difficulty::Medium, t0, at));
        REQUIRE(countKind(m, AlertKind::CorrelatedSolves) == (i == 3 ? 0u : 0u));  // not yet (B has not solved)
        m.noteSolve(solve("t_b", c, Difficulty::Medium, t0, at + seconds(2)));
        REQUIRE(countKind(m, AlertKind::CorrelatedSolves) == (i >= 3 ? 1u : 0u));  // alert on the 3rd shared challenge
    }
    const Alert& alert = m.alerts().back();
    REQUIRE(alert.kind == AlertKind::CorrelatedSolves);
    REQUIRE(alert.teams.size() == 2);

    // a fourth shared challenge does not raise a second alert for the same pair
    m.noteSolve(solve("t_a", "c_4", Difficulty::Medium, t0, t0 + seconds(500)));
    m.noteSolve(solve("t_b", "c_4", Difficulty::Medium, t0, t0 + seconds(501)));
    REQUIRE(countKind(m, AlertKind::CorrelatedSolves) == 1);
}

TEST_CASE("Teams that solve far apart, or only twice together, are not correlated", "[events][anticheat][correlation]") {
    AntiCheatMonitor m;
    AntiCheatConfig cfg;
    cfg.fastSolveEasySeconds = cfg.fastSolveMediumSeconds = cfg.fastSolveHardSeconds = 0;
    m.setConfig(cfg);
    const TimePoint t0 = Clock::now();

    for (int i = 1; i <= 5; ++i) {  // always 60s apart: outside the 5s window
        const std::string c = "c_" + std::to_string(i);
        m.noteSolve(solve("t_a", c, Difficulty::Hard, t0, t0 + seconds(i * 1000)));
        m.noteSolve(solve("t_b", c, Difficulty::Hard, t0, t0 + seconds(i * 1000 + 60)));
    }
    REQUIRE(countKind(m, AlertKind::CorrelatedSolves) == 0);

    for (int i = 6; i <= 7; ++i) {  // together, but only twice (below the 3-challenge minimum)
        const std::string c = "c_" + std::to_string(i);
        m.noteSolve(solve("t_c", c, Difficulty::Hard, t0, t0 + seconds(i * 1000)));
        m.noteSolve(solve("t_d", c, Difficulty::Hard, t0, t0 + seconds(i * 1000 + 1)));
    }
    REQUIRE(countKind(m, AlertKind::CorrelatedSolves) == 0);
}

TEST_CASE("The new alert kinds round-trip through their wire names", "[events][anticheat]") {
    REQUIRE(alertKindFromString(toString(AlertKind::FastSolve)) == AlertKind::FastSolve);
    REQUIRE(alertKindFromString("CORRELATED_SOLVES") == AlertKind::CorrelatedSolves);
}

TEST_CASE("Anti-cheat thresholds are admin-only, validated and persisted", "[app][manager][anticheat]") {
    const std::string dir = ctftest::makeTempDir();
    {
        app::CTFManager mgr("test-secret", dir, std::make_unique<ctftest::FakeClock>());
        auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
        auto alice = mgr.registerUser("alice", "alice@x.com", "password123");

        REQUIRE_THROWS_AS(mgr.antiCheatConfig(alice.me.id), PermissionException);
        REQUIRE(mgr.antiCheatConfig(admin.me.id) == AntiCheatConfig{});  // defaults

        AntiCheatConfig bad;
        bad.fastSolveHardSeconds = -1;
        REQUIRE_THROWS_AS(mgr.setAntiCheatConfig(admin.me.id, bad), ValidationException);
        bad = AntiCheatConfig{};
        bad.correlationMinChallenges = 51;
        REQUIRE_THROWS_AS(mgr.setAntiCheatConfig(admin.me.id, bad), ValidationException);

        AntiCheatConfig tuned;
        tuned.fastSolveHardSeconds = 0;       // disable one rule
        tuned.correlationWindowSeconds = 9;
        REQUIRE(mgr.setAntiCheatConfig(admin.me.id, tuned) == tuned);
    }
    app::CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto admin = reloaded.login("admin", "password123");
    const auto cfg = reloaded.antiCheatConfig(admin.me.id);
    REQUIRE(cfg.fastSolveHardSeconds == 0);
    REQUIRE(cfg.correlationWindowSeconds == 9);
}

TEST_CASE("The manager raises a fast-solve alert for a real instant solve", "[app][manager][anticheat]") {
    app::CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    mgr.createTeam(alice.me.id, "Alpha");

    ChallengeSpec s;
    s.id = "c_1";
    s.title = "Hard one";
    s.difficulty = Difficulty::Hard;
    s.basePoints = 400;
    s.scoring = ScoringKind::Static;
    s.flagType = FlagType::Static;
    s.flag = "CTF{x}";
    mgr.createChallenge(admin.me.id, s);
    mgr.startEvent(admin.me.id);  // the fake clock does not advance: solved 0s after the event began

    REQUIRE(mgr.submitFlag(alice.me.id, "c_1", "CTF{x}").result == SubmitResult::Correct);
    const auto alerts = mgr.alerts(admin.me.id);
    REQUIRE(alerts.size() == 1);
    REQUIRE(alerts[0].kind == AlertKind::FastSolve);
}
