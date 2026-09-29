#include <catch2/catch_test_macros.hpp>

#include "ctf/scoring/ScoringStrategies.hpp"

using namespace ctf::scoring;

namespace {
ScoringContext ctx(int base, int minPts, int decay, int solves, bool fb = false) {
    return ScoringContext{base, minPts, decay, solves, fb};
}
}  // namespace

TEST_CASE("StaticScoring always returns base points", "[scoring][static]") {
    StaticScoring s;
    REQUIRE(s.pointsFor(ctx(300, 60, 10, 0)) == 300);
    REQUIRE(s.pointsFor(ctx(300, 60, 10, 99)) == 300);
}

TEST_CASE("DecayScoring follows the parabolic curve and floors at min", "[scoring][decay]") {
    DecayScoring d;
    // base=500, min=100, decay=10  ->  value(s) = -4*s^2 + 500
    REQUIRE(d.pointsFor(ctx(500, 100, 10, 0)) == 500);
    REQUIRE(d.pointsFor(ctx(500, 100, 10, 1)) == 496);
    REQUIRE(d.pointsFor(ctx(500, 100, 10, 5)) == 400);
    REQUIRE(d.pointsFor(ctx(500, 100, 10, 10)) == 100);
    REQUIRE(d.pointsFor(ctx(500, 100, 10, 50)) == 100);  // clamped at min
}

TEST_CASE("DecayScoring is monotonically non-increasing and never below min", "[scoring][decay]") {
    DecayScoring d;
    int prev = 1'000'000;
    for (int s = 0; s <= 40; ++s) {
        const int pts = d.pointsFor(ctx(250, 50, 10, s));
        REQUIRE(pts <= prev);
        REQUIRE(pts >= 50);
        prev = pts;
    }
}

TEST_CASE("DecayScoring rounds up (ceil)", "[scoring][decay]") {
    DecayScoring d;
    // base=100, min=20, decay=10 -> value(3) = -0.8*9 + 100 = 92.8 -> 93
    REQUIRE(d.pointsFor(ctx(100, 20, 10, 3)) == 93);
}

TEST_CASE("FirstBloodScoring decorates and adds the bonus only once", "[scoring][firstblood]") {
    FirstBloodScoring fb(std::make_unique<DecayScoring>());
    // first blood at s=0: 500 + 10% of 500 = 550
    REQUIRE(fb.pointsFor(ctx(500, 100, 10, 0, true)) == 550);
    // not first blood: just the decayed value
    REQUIRE(fb.pointsFor(ctx(500, 100, 10, 0, false)) == 500);

    auto clone = fb.clone();
    REQUIRE(clone->pointsFor(ctx(500, 100, 10, 0, true)) == 550);
}
