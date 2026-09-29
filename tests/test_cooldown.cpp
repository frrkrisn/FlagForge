#include <catch2/catch_test_macros.hpp>

#include <chrono>

#include "ctf/events/CooldownTracker.hpp"

using namespace ctf;
using namespace ctf::events;
using namespace std::chrono;

TEST_CASE("Cooldown triggers after kMaxWrong wrong attempts in the window", "[events][cooldown]") {
    CooldownTracker cd;
    const TimePoint base = Clock::now();
    int left = 0;

    for (int i = 0; i < CooldownTracker::kMaxWrong - 1; ++i) {
        REQUIRE_FALSE(cd.recordWrong("t_1", "c_1", base + seconds(i)));
    }
    REQUIRE_FALSE(cd.isOnCooldown("t_1", "c_1", base + seconds(4), left));

    // the 5th wrong attempt triggers the cooldown
    REQUIRE(cd.recordWrong("t_1", "c_1", base + seconds(5)));
    REQUIRE(cd.isOnCooldown("t_1", "c_1", base + seconds(5), left));
    REQUIRE(left > 0);
    REQUIRE(left <= 30);
}

TEST_CASE("Cooldown expires after its duration", "[events][cooldown]") {
    CooldownTracker cd;
    const TimePoint base = Clock::now();
    int left = 0;
    for (int i = 0; i < CooldownTracker::kMaxWrong; ++i) {
        cd.recordWrong("t_1", "c_1", base + seconds(i));
    }
    REQUIRE(cd.isOnCooldown("t_1", "c_1", base + seconds(10), left));
    REQUIRE_FALSE(cd.isOnCooldown("t_1", "c_1", base + seconds(60), left));
    REQUIRE(left == 0);
}

TEST_CASE("Old wrong attempts outside the window don't count", "[events][cooldown]") {
    CooldownTracker cd;
    const TimePoint base = Clock::now();
    for (int i = 0; i < CooldownTracker::kMaxWrong - 1; ++i) {
        cd.recordWrong("t_1", "c_1", base + seconds(i));
    }
    // a wrong attempt well after the window: the earlier ones are pruned
    REQUIRE_FALSE(cd.recordWrong("t_1", "c_1", base + seconds(120)));
}

TEST_CASE("Cooldown is per team and per challenge", "[events][cooldown]") {
    CooldownTracker cd;
    const TimePoint base = Clock::now();
    int left = 0;
    for (int i = 0; i < CooldownTracker::kMaxWrong; ++i) {
        cd.recordWrong("t_1", "c_1", base + seconds(i));
    }
    REQUIRE(cd.isOnCooldown("t_1", "c_1", base + seconds(5), left));
    REQUIRE_FALSE(cd.isOnCooldown("t_1", "c_2", base + seconds(5), left));  // other challenge
    REQUIRE_FALSE(cd.isOnCooldown("t_2", "c_1", base + seconds(5), left));  // other team
}
