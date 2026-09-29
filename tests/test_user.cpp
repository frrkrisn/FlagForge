#include <catch2/catch_test_macros.hpp>

#include "ctf/Exceptions.hpp"
#include "ctf/core/User.hpp"

using namespace ctf;

TEST_CASE("Player role, team membership and solves", "[core][user]") {
    Player p("u_1", "neo", "neo@example.com");
    REQUIRE(p.role() == Role::Player);
    REQUIRE(p.username() == "neo");
    REQUIRE(p.avatarSeed() == "neo");  // defaults to username
    REQUIRE_FALSE(p.hasTeam());

    p.joinTeam("t_1");
    REQUIRE(p.hasTeam());
    REQUIRE(p.teamId().value() == "t_1");
    p.incrementSolves();
    REQUIRE(p.personalSolves() == 1);
    p.leaveTeam();
    REQUIRE_FALSE(p.hasTeam());
}

TEST_CASE("Admin role", "[core][user]") {
    Admin a("u_admin", "root", "root@example.com");
    REQUIRE(a.role() == Role::Admin);
}

TEST_CASE("Password hashing round-trips and rejects wrong input", "[core][user]") {
    Player p("u_2", "trinity", "t@example.com");
    p.setPassword("whiteRabbit1");
    REQUIRE(p.verifyPassword("whiteRabbit1"));
    REQUIRE_FALSE(p.verifyPassword("redPill"));
    // the plaintext is never stored
    REQUIRE(p.passwordHash().find("whiteRabbit1") == std::string::npos);
}

TEST_CASE("Profile validation failure paths", "[core][user]") {
    Player p("u_3", "cypher", "c@example.com");
    REQUIRE_THROWS_AS(p.setPassword("short"), ValidationException);
    REQUIRE_THROWS_AS(p.setBio(std::string(1000, 'x')), ValidationException);
    REQUIRE_THROWS_AS(p.setAvatarSeed(""), ValidationException);
    REQUIRE_THROWS_AS(p.setThemePrefs(std::string(4096, '{')), ValidationException);
}
