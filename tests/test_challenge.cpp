#include <catch2/catch_test_macros.hpp>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Challenge.hpp"
#include "ctf/core/ChallengeFactory.hpp"

using namespace ctf;

TEST_CASE("StaticChallenge checks a flag by hash", "[core][challenge][static]") {
    ChallengeSpec spec;
    spec.id = "c_1";
    spec.title = "Welcome Flag";
    spec.category = Category::Misc;
    spec.basePoints = 50;
    spec.scoring = ScoringKind::Static;
    spec.flagType = FlagType::Static;
    spec.flag = "CTF{welcome_to_flagforge}";

    auto ch = ChallengeFactory::create(spec);
    REQUIRE(ch->typeTag() == std::string("STATIC"));
    FlagCheckContext ctx{"t_1", "server-secret"};
    REQUIRE(ch->checkFlag(ctx, "CTF{welcome_to_flagforge}"));
    REQUIRE_FALSE(ch->checkFlag(ctx, "CTF{nope}"));
}

TEST_CASE("Static challenge with no flag is rejected", "[core][challenge][factory]") {
    ChallengeSpec spec;
    spec.title = "Broken";
    spec.flagType = FlagType::Static;
    spec.flag = "";
    REQUIRE_THROWS_AS(ChallengeFactory::create(spec), ValidationException);
}

TEST_CASE("DynamicFlagChallenge derives a per-team flag via HMAC", "[core][challenge][dynamic]") {
    ChallengeSpec spec;
    spec.id = "c_7";
    spec.title = "Team Token";
    spec.category = Category::Web;
    spec.basePoints = 300;
    spec.scoring = ScoringKind::DynamicScore;
    spec.flagType = FlagType::Dynamic;
    spec.flagPrefix = "CTF";

    auto ch = ChallengeFactory::create(spec);
    auto* dyn = dynamic_cast<DynamicFlagChallenge*>(ch.get());
    REQUIRE(dyn != nullptr);

    const std::string secret = "top-secret-key";
    const std::string flagA = dyn->expectedFlagFor("t_a", secret);
    const std::string flagB = dyn->expectedFlagFor("t_b", secret);

    REQUIRE(flagA.rfind("CTF{", 0) == 0);         // correct prefix
    REQUIRE(flagA.back() == '}');
    REQUIRE(flagA != flagB);                       // per-team
    REQUIRE(flagA == dyn->expectedFlagFor("t_a", secret));  // deterministic

    FlagCheckContext ctxA{"t_a", secret};
    REQUIRE(dyn->checkFlag(ctxA, flagA));
    REQUIRE_FALSE(dyn->checkFlag(ctxA, flagB));    // another team's flag is wrong for t_a
}

TEST_CASE("currentPoints delegates to the scoring strategy", "[core][challenge][scoring]") {
    ChallengeSpec spec;
    spec.id = "c_2";
    spec.title = "Inspect Me";
    spec.category = Category::Web;
    spec.basePoints = 100;
    spec.minPoints = 20;
    spec.decay = 10;
    spec.scoring = ScoringKind::Decay;
    spec.flagType = FlagType::Static;
    spec.flag = "CTF{x}";

    auto ch = ChallengeFactory::create(spec);
    REQUIRE(ch->currentPoints(0, false) == 100);
    REQUIRE(ch->currentPoints(10, false) == 20);   // decayed to the floor
}

TEST_CASE("Hints and prerequisites are attached by the factory", "[core][challenge][factory]") {
    ChallengeSpec spec;
    spec.title = "Robots Rule";
    spec.basePoints = 200;
    spec.flagType = FlagType::Static;
    spec.flag = "CTF{y}";
    spec.prerequisites = {"c_2"};
    spec.hints = {{"Check /robots.txt", 20}, {"Look at the disallow line", 40}};

    auto ch = ChallengeFactory::create(spec);
    REQUIRE(ch->prerequisites().size() == 1);
    REQUIRE(ch->hints().size() == 2);
    REQUIRE(ch->findHint("h_1") != nullptr);
    REQUIRE(ch->findHint("h_1")->cost() == 20);
    REQUIRE(ch->findHint("h_99") == nullptr);
}
