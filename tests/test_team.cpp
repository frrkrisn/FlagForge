#include <catch2/catch_test_macros.hpp>

#include <sstream>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Team.hpp"

using namespace ctf;

namespace {
SolveRecord solve(const ChallengeId& c, bool firstBlood = false) {
    return SolveRecord{c, "u_x", Clock::now(), firstBlood};
}
}  // namespace

TEST_CASE("Team starts with the captain as its first member", "[core][team]") {
    Team t("t_1", "NullPointers", "u_cap", "INVITE1");
    REQUIRE(t.size() == 1);
    REQUIRE(t.captainId() == "u_cap");
    REQUIRE(t.hasMember("u_cap"));
    REQUIRE_FALSE(t.isFull());
}

TEST_CASE("Capacity is enforced at kMaxSize", "[core][team]") {
    Team t("t_1", "SegFaultSquad", "u_cap", "INVITE1");
    t.addMember("u_2");
    t.addMember("u_3");
    t.addMember("u_4");
    REQUIRE(t.size() == Team::kMaxSize);
    REQUIRE(t.isFull());
    REQUIRE_THROWS_AS(t.addMember("u_5"), TeamFullException);
    // adding an existing member is idempotent, not an error
    REQUIRE_NOTHROW(t.addMember("u_2"));
    REQUIRE(t.size() == Team::kMaxSize);
}

TEST_CASE("Solves are unique per team; operator+= records", "[core][team]") {
    Team t("t_1", "StackSmashers", "u_cap", "INVITE1");
    t += solve("c_1");
    REQUIRE(t.hasSolved("c_1"));
    REQUIRE(t.solves().size() == 1);
    REQUIRE_THROWS_AS(t.recordSolve(solve("c_1")), DuplicateSolveException);
}

TEST_CASE("Hint unlocks are idempotent (charge once)", "[core][team]") {
    Team t("t_1", "RootAccess", "u_cap", "INVITE1");
    HintUnlock u{"c_1", "h_1", 20, Clock::now()};
    t.recordHintUnlock(u);
    t.recordHintUnlock(u);
    REQUIRE(t.hintUnlocks().size() == 1);
    REQUIRE(t.hasUnlockedHint("c_1", "h_1"));
}

TEST_CASE("Captaincy transfers when the captain is removed", "[core][team]") {
    Team t("t_1", "ByteBenders", "u_cap", "INVITE1");
    t.addMember("u_2");
    t.removeMember("u_cap");
    REQUIRE(t.captainId() == "u_2");
    REQUIRE_FALSE(t.hasMember("u_cap"));
    REQUIRE_THROWS_AS(t.removeMember("u_ghost"), NotFoundException);
}

TEST_CASE("operator< orders by name; operator<< prints a summary", "[core][team]") {
    Team a("t_a", "AAA", "u1", "i1");
    Team b("t_b", "BBB", "u2", "i2");
    REQUIRE(a < b);
    REQUIRE_FALSE(b < a);

    std::ostringstream os;
    os << a;
    REQUIRE(os.str().find("AAA") != std::string::npos);
    REQUIRE(os.str().find("members=1") != std::string::npos);
}
