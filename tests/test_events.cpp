#include <catch2/catch_test_macros.hpp>

#include <memory>

#include "ctf/events/EventBus.hpp"
#include "ctf/events/Observers.hpp"

using namespace ctf;
using namespace ctf::events;

namespace {
struct CountingObserver : IEventObserver {
    int count = 0;
    void onEvent(const Event&) override { ++count; }
};

Event solveEvent() {
    Event e;
    e.type = EventType::Solve;
    e.timestamp = Clock::now();
    e.message = "a solve";
    return e;
}
}  // namespace

TEST_CASE("EventBus notifies every subscribed observer", "[events][bus]") {
    EventBus bus;
    auto a = std::make_shared<CountingObserver>();
    auto b = std::make_shared<CountingObserver>();
    bus.subscribe(a);
    bus.subscribe(b);
    bus.subscribe(a);  // duplicate ignored
    REQUIRE(bus.observerCount() == 2);

    bus.publish(solveEvent());
    REQUIRE(a->count == 1);
    REQUIRE(b->count == 1);
}

TEST_CASE("Adding a new observer needs no change to the publisher", "[events][bus]") {
    EventBus bus;
    auto feed = std::make_shared<ActivityFeed>(200);
    auto log = std::make_shared<EventLog>();
    bus.subscribe(feed);
    bus.subscribe(log);

    // A brand-new observer type can join later; publish() is untouched.
    auto extra = std::make_shared<CountingObserver>();
    bus.subscribe(extra);

    bus.publish(solveEvent());
    REQUIRE(feed->latestId() == 1);
    REQUIRE(log->size() == 1);
    REQUIRE(extra->count == 1);
}

TEST_CASE("Expired observers are pruned safely", "[events][bus]") {
    EventBus bus;
    auto keep = std::make_shared<CountingObserver>();
    bus.subscribe(keep);
    {
        auto temp = std::make_shared<CountingObserver>();
        bus.subscribe(temp);
        REQUIRE(bus.observerCount() == 2);
    }  // temp destroyed here
    bus.publish(solveEvent());  // must not crash on the expired weak_ptr
    REQUIRE(keep->count == 1);
    REQUIRE(bus.observerCount() == 1);
}

TEST_CASE("ActivityFeed is a bounded ring with monotonic ids", "[events][feed]") {
    ActivityFeed feed(3);
    for (int i = 0; i < 5; ++i) feed.onEvent(solveEvent());
    REQUIRE(feed.latestId() == 5);
    // capacity 3 -> only the last three survive
    REQUIRE(feed.since(0).size() == 3);
    // since(latest-1) returns just the newest
    REQUIRE(feed.since(4).size() == 1);
}
