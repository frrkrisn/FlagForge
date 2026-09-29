#include <catch2/catch_test_macros.hpp>

#include "ctf/core/Submission.hpp"

using namespace ctf;

TEST_CASE("Submission bumps the static instance counter", "[core][submission]") {
    const std::size_t before = Submission::totalCount();
    Submission s("t_1", "u_1", "c_1", Clock::now(), SubmitResult::Correct);
    REQUIRE(Submission::totalCount() == before + 1);
}

TEST_CASE("Submission value equality via operator==", "[core][submission]") {
    const TimePoint now = Clock::now();
    Submission a("t_1", "u_1", "c_1", now, SubmitResult::Correct);
    Submission b("t_1", "u_1", "c_1", now, SubmitResult::Correct);
    Submission c("t_1", "u_1", "c_1", now, SubmitResult::Wrong);
    REQUIRE(a == b);
    REQUIRE(a != c);
}
