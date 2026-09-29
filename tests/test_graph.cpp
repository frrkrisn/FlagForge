#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <vector>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Challenge.hpp"
#include "ctf/core/ChallengeFactory.hpp"
#include "ctf/core/ChallengeGraph.hpp"

using namespace ctf;

namespace {
std::unique_ptr<Challenge> make(const ChallengeId& id, std::vector<ChallengeId> prereqs) {
    ChallengeSpec spec;
    spec.id = id;
    spec.title = id;
    spec.basePoints = 100;
    spec.flagType = FlagType::Static;
    spec.flag = "CTF{" + id + "}";
    spec.prerequisites = std::move(prereqs);
    return ChallengeFactory::create(spec);
}

ChallengeSpan spanOf(const std::vector<std::unique_ptr<Challenge>>& v) {
    ChallengeSpan span;
    for (const auto& c : v) span.push_back(c.get());
    return span;
}
}  // namespace

TEST_CASE("A valid prerequisite chain passes validation", "[core][graph]") {
    std::vector<std::unique_ptr<Challenge>> v;
    v.push_back(make("c_1", {}));
    v.push_back(make("c_2", {"c_1"}));
    v.push_back(make("c_3", {"c_2"}));
    REQUIRE_NOTHROW(validatePrerequisiteGraph(spanOf(v)));
}

TEST_CASE("An unknown prerequisite id is rejected", "[core][graph]") {
    std::vector<std::unique_ptr<Challenge>> v;
    v.push_back(make("c_1", {"c_missing"}));
    REQUIRE_THROWS_AS(validatePrerequisiteGraph(spanOf(v)), ValidationException);
}

TEST_CASE("A prerequisite cycle is detected", "[core][graph]") {
    std::vector<std::unique_ptr<Challenge>> v;
    v.push_back(make("c_1", {"c_3"}));
    v.push_back(make("c_2", {"c_1"}));
    v.push_back(make("c_3", {"c_2"}));  // 1 -> 3 -> 2 -> 1
    REQUIRE_THROWS_AS(validatePrerequisiteGraph(spanOf(v)), ValidationException);
}

TEST_CASE("wouldCreateCycle predicts a cycle before saving", "[core][graph]") {
    std::vector<std::unique_ptr<Challenge>> v;
    v.push_back(make("c_1", {}));
    v.push_back(make("c_2", {"c_1"}));
    v.push_back(make("c_3", {"c_2"}));
    const auto span = spanOf(v);
    REQUIRE(wouldCreateCycle(span, "c_1", {"c_3"}));      // would close the loop
    REQUIRE_FALSE(wouldCreateCycle(span, "c_3", {"c_1"}));  // already reachable, still a DAG
}

TEST_CASE("missingPrerequisites lists unsolved dependencies", "[core][graph]") {
    std::vector<std::unique_ptr<Challenge>> v;
    v.push_back(make("c_1", {}));
    v.push_back(make("c_2", {"c_1"}));
    v.push_back(make("c_3", {"c_1", "c_2"}));
    const auto span = spanOf(v);
    const auto missing = missingPrerequisites(span, "c_3", {"c_1"});
    REQUIRE(missing.size() == 1);
    REQUIRE(missing.front() == "c_2");
}
