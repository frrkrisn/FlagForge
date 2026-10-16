#include <catch2/catch_test_macros.hpp>

#include <string>

#include "ctf/Exceptions.hpp"
#include "ctf/app/CTFManager.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;

TEST_CASE("Team chat is private to the team and survives a restart", "[app][manager][chat]") {
    const std::string dir = ctftest::makeTempDir();
    {
        CTFManager mgr("test-secret", dir, std::make_unique<ctftest::FakeClock>());
        mgr.registerUser("admin", "admin@x.com", "password123");  // first user is the admin
        auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
        auto bob = mgr.registerUser("bob", "bob@x.com", "password123");
        auto carol = mgr.registerUser("carol", "carol@x.com", "password123");
        auto loner = mgr.registerUser("loner", "loner@x.com", "password123");
        auto team = mgr.createTeam(alice.me.id, "Alpha");
        mgr.joinTeam(bob.me.id, *team.inviteCode);
        mgr.createTeam(carol.me.id, "Bravo");

        auto m = mgr.postChat(alice.me.id, "  try the cookie first  ");
        CHECK(m.text == "try the cookie first");  // trimmed
        CHECK(m.username == "alice");
        mgr.postChat(bob.me.id, "on it");

        auto seen = mgr.teamChat(bob.me.id, 0);
        REQUIRE(seen.size() == 2);
        CHECK(seen[0].id < seen[1].id);
        CHECK(mgr.teamChat(bob.me.id, seen[0].id).size() == 1);  // since-cursor

        CHECK(mgr.teamChat(carol.me.id, 0).empty());  // other team sees nothing
        REQUIRE_THROWS(mgr.teamChat(loner.me.id, 0));  // no team, no room
        REQUIRE_THROWS(mgr.postChat(loner.me.id, "hi"));

        REQUIRE_THROWS_AS(mgr.postChat(alice.me.id, "   "), ValidationException);
        REQUIRE_THROWS_AS(mgr.postChat(alice.me.id, std::string(501, 'x')), ValidationException);
    }

    CTFManager reloaded("test-secret", dir, std::make_unique<ctftest::FakeClock>());
    reloaded.load();
    auto bob = reloaded.login("bob", "password123");
    auto history = reloaded.teamChat(bob.me.id, 0);
    REQUIRE(history.size() == 2);
    CHECK(history[0].text == "try the cookie first");
    // ids keep increasing after a restart
    CHECK(reloaded.postChat(bob.me.id, "later").id > history[1].id);
}

TEST_CASE("Chat keeps only the most recent 300 messages per team", "[app][manager][chat]") {
    CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    mgr.registerUser("admin", "admin@x.com", "password123");  // first user is the admin
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    mgr.createTeam(alice.me.id, "Alpha");
    for (int i = 0; i < 305; ++i) mgr.postChat(alice.me.id, "m" + std::to_string(i));
    auto all = mgr.teamChat(alice.me.id, 0);
    REQUIRE(all.size() == 300);
    CHECK(all.front().text == "m5");
    CHECK(all.back().text == "m304");
}
