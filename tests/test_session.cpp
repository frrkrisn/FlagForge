#include <catch2/catch_test_macros.hpp>

#include <chrono>

#include "ctf/app/SessionManager.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;
using namespace std::chrono;

TEST_CASE("Sessions resolve to their user and can be revoked", "[app][session]") {
    ctftest::FakeClock clock;
    SessionManager sm(clock);

    const SessionToken token = sm.create("u_neo");
    REQUIRE(sm.lookup(token).value() == "u_neo");
    REQUIRE(sm.activeCount() == 1);

    sm.revoke(token);
    REQUIRE_FALSE(sm.lookup(token).has_value());
    REQUIRE(sm.activeCount() == 0);
}

TEST_CASE("Sessions expire after the TTL", "[app][session]") {
    ctftest::FakeClock clock;
    SessionManager sm(clock);
    const SessionToken token = sm.create("u_neo");

    clock.advance(hours(13));  // past the 12h default TTL
    REQUIRE_FALSE(sm.lookup(token).has_value());
    REQUIRE(sm.activeCount() == 0);
}

TEST_CASE("Unknown tokens resolve to nothing", "[app][session]") {
    ctftest::FakeClock clock;
    SessionManager sm(clock);
    REQUIRE_FALSE(sm.lookup("not-a-real-token").has_value());
}

TEST_CASE("revokeAllFor clears every session of a user", "[app][session]") {
    ctftest::FakeClock clock;
    SessionManager sm(clock);
    sm.create("u_neo");
    sm.create("u_neo");
    sm.create("u_trinity");
    REQUIRE(sm.activeCount() == 3);
    sm.revokeAllFor("u_neo");
    REQUIRE(sm.activeCount() == 1);
}
