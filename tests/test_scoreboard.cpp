#include <catch2/catch_test_macros.hpp>

#include <chrono>
#include <memory>
#include <vector>

#include "ctf/core/Challenge.hpp"
#include "ctf/core/ChallengeFactory.hpp"
#include "ctf/core/Team.hpp"
#include "ctf/scoring/Scoreboard.hpp"

using namespace ctf;
using namespace ctf::scoring;
using namespace std::chrono;

namespace {
std::unique_ptr<Challenge> decayChallenge(const ChallengeId& id, int base = 100) {
    ChallengeSpec spec;
    spec.id = id;
    spec.title = id;
    spec.basePoints = base;
    spec.minPoints = base / 5;
    spec.decay = 10;
    spec.scoring = ScoringKind::Decay;
    spec.flagType = FlagType::Static;
    spec.flag = "CTF{" + id + "}";
    return ChallengeFactory::create(spec);
}
SolveRecord solve(const ChallengeId& c, TimePoint at, bool fb = false) {
    return SolveRecord{c, "u", at, fb};
}
}  // namespace

TEST_CASE("Scores are derived from current challenge values", "[scoring][scoreboard]") {
    auto c1 = decayChallenge("c_1");
    auto c2 = decayChallenge("c_2");
    ChallengeView challenges{c1.get(), c2.get()};

    const TimePoint base = Clock::now();
    Team a("t_a", "Alpha", "u_a", "ia");
    Team b("t_b", "Bravo", "u_b", "ib");
    a.recordSolve(solve("c_1", base));
    a.recordSolve(solve("c_2", base + seconds(20)));
    b.recordSolve(solve("c_1", base + seconds(10)));

    TeamView teams{&a, &b};
    Scoreboard sb;
    const auto rows = sb.compute(teams, challenges, base + seconds(60));

    // c_1 has 2 solves -> value 97; c_2 has 1 solve -> value 100.
    REQUIRE(rows.size() == 2);
    REQUIRE(rows[0].teamId == "t_a");
    REQUIRE(rows[0].score == 197);
    REQUIRE(rows[0].rank == 1);
    REQUIRE(rows[1].teamId == "t_b");
    REQUIRE(rows[1].score == 97);
    REQUIRE(rows[1].rank == 2);
    REQUIRE(rows[0].categorySolves.at(Category::Misc) == 2);
}

TEST_CASE("Tie-break: equal score, earliest last-solve ranks higher", "[scoring][scoreboard]") {
    auto c1 = decayChallenge("c_1");
    ChallengeView challenges{c1.get()};
    const TimePoint base = Clock::now();

    Team c("t_c", "Charlie", "u_c", "ic");
    Team d("t_d", "Delta", "u_d", "id");
    c.recordSolve(solve("c_1", base));                 // earlier
    d.recordSolve(solve("c_1", base + seconds(30)));   // later

    TeamView teams{&d, &c};  // deliberately unsorted input
    Scoreboard sb;
    const auto rows = sb.compute(teams, challenges, base + seconds(60));
    REQUIRE(rows[0].score == rows[1].score);  // same points
    REQUIRE(rows[0].teamId == "t_c");         // earlier solver first
    REQUIRE(rows[1].teamId == "t_d");
}

TEST_CASE("Freeze snapshot ignores solves after the freeze time", "[scoring][scoreboard][freeze]") {
    auto c1 = decayChallenge("c_1");
    auto c2 = decayChallenge("c_2");
    ChallengeView challenges{c1.get(), c2.get()};
    const TimePoint base = Clock::now();

    Team a("t_a", "Alpha", "u_a", "ia");
    a.recordSolve(solve("c_1", base));                  // before freeze
    a.recordSolve(solve("c_2", base + seconds(100)));   // after freeze

    TeamView teams{&a};
    Scoreboard sb;
    const TimePoint freezeAt = base + seconds(50);
    const auto snap = sb.snapshotAt(teams, challenges, freezeAt);
    const auto live = sb.compute(teams, challenges, base + seconds(200));

    REQUIRE(snap.rows[0].solves == 1);  // only c_1 counted at freeze
    REQUIRE(live[0].solves == 2);
    REQUIRE(snap.rows[0].score < live[0].score);
}

TEST_CASE("rankDelta reflects movement between computes", "[scoring][scoreboard]") {
    auto c1 = decayChallenge("c_1", 100);
    auto c2 = decayChallenge("c_2", 500);
    ChallengeView challenges{c1.get(), c2.get()};
    const TimePoint base = Clock::now();

    Team a("t_a", "Alpha", "u_a", "ia");
    Team b("t_b", "Bravo", "u_b", "ib");
    a.recordSolve(solve("c_1", base));  // A leads first
    b.recordSolve(solve("c_1", base + seconds(5)));

    TeamView teams{&a, &b};
    Scoreboard sb;
    auto first = sb.compute(teams, challenges, base + seconds(10));
    REQUIRE(first[0].teamId == "t_a");

    b.recordSolve(solve("c_2", base + seconds(20)));  // B overtakes with the 500-pt solve
    auto second = sb.compute(teams, challenges, base + seconds(30));
    REQUIRE(second[0].teamId == "t_b");
    REQUIRE(second[0].rankDelta == 1);   // moved 2 -> 1
    REQUIRE(second[1].rankDelta == -1);  // A moved 1 -> 2
}

TEST_CASE("timeline yields a point per scoring event, ending at the current score",
          "[scoring][scoreboard][timeline]") {
    auto c1 = decayChallenge("c_1");
    auto c2 = decayChallenge("c_2");
    ChallengeView challenges{c1.get(), c2.get()};
    const TimePoint base = Clock::now();

    Team a("t_a", "Alpha", "u_a", "ia");
    a.recordSolve(solve("c_1", base));
    a.recordSolve(solve("c_2", base + seconds(20)));

    TeamView teams{&a};
    Scoreboard sb;
    const auto tl = sb.timeline(teams, challenges, 10, base + seconds(60));
    REQUIRE(tl.size() == 1);
    REQUIRE(tl[0].points.size() == 2);
    REQUIRE(tl[0].points.back().score == sb.scoreOf(a, teams, challenges, base + seconds(60)));
}
