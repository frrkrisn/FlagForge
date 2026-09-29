#include <catch2/catch_test_macros.hpp>

#include <chrono>

#include "ctf/events/AntiCheatMonitor.hpp"

using namespace ctf;
using namespace ctf::events;
using namespace std::chrono;

namespace {
Event flagSharing(const TeamId& submitter, const TeamId& owner, const ChallengeId& c) {
    Event e;
    e.type = EventType::FlagSharing;
    e.timestamp = Clock::now();
    e.teamId = submitter;
    e.otherTeamId = owner;
    e.challengeId = c;
    e.message = submitter + " submitted " + owner + "'s flag";
    return e;
}
Event wrongAttempt(const TeamId& t, TimePoint at) {
    Event e;
    e.type = EventType::WrongAttempt;
    e.timestamp = at;
    e.teamId = t;
    return e;
}
}  // namespace

TEST_CASE("FlagSharing event raises an alert naming both teams", "[events][anticheat]") {
    AntiCheatMonitor mon;
    mon.onEvent(flagSharing("t_byte", "t_null", "c_7"));

    auto open = mon.openAlerts();
    REQUIRE(open.size() == 1);
    REQUIRE(open[0].kind == AlertKind::FlagSharing);
    REQUIRE(open[0].teams.size() == 2);
    REQUIRE(open[0].challengeId.value() == "c_7");

    mon.dismiss(open[0].id);
    REQUIRE(mon.openAlerts().empty());
    REQUIRE(mon.alerts().size() == 1);  // dismissed, not deleted
}

TEST_CASE("Same wrong flag from 3+ teams raises one alert", "[events][anticheat]") {
    AntiCheatMonitor mon;
    const TimePoint now = Clock::now();
    mon.noteWrongFlag("t_1", "c_3", "deadbeefhash", now);
    mon.noteWrongFlag("t_2", "c_3", "deadbeefhash", now);
    REQUIRE(mon.openAlerts().empty());  // only 2 teams so far

    mon.noteWrongFlag("t_3", "c_3", "deadbeefhash", now);
    auto open = mon.openAlerts();
    REQUIRE(open.size() == 1);
    REQUIRE(open[0].kind == AlertKind::SameWrongFlagMultiTeam);

    mon.noteWrongFlag("t_4", "c_3", "deadbeefhash", now);  // still one alert (dedup)
    REQUIRE(mon.openAlerts().size() == 1);
}

TEST_CASE("A submission burst raises exactly one alert", "[events][anticheat]") {
    AntiCheatMonitor mon;
    const TimePoint now = Clock::now();
    for (int i = 0; i <= AntiCheatMonitor::kBurstMax; ++i) {  // kBurstMax+1 submissions
        mon.onEvent(wrongAttempt("t_spam", now));
    }
    auto burst = mon.openAlerts();
    REQUIRE(burst.size() == 1);
    REQUIRE(burst[0].kind == AlertKind::BurstSubmissions);

    mon.onEvent(wrongAttempt("t_spam", now));  // still one (already alerted this window)
    REQUIRE(mon.openAlerts().size() == 1);
}
