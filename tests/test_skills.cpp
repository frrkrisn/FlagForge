#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <vector>

#include "ctf/core/ChallengeFactory.hpp"
#include "ctf/core/Skills.hpp"

using namespace ctf;

namespace {
std::unique_ptr<Challenge> make(const std::string& id, Category cat, Difficulty diff, bool visible = true) {
    ChallengeSpec s;
    s.id = id;
    s.title = id;
    s.category = cat;
    s.difficulty = diff;
    s.basePoints = 100;
    s.scoring = ScoringKind::Static;
    s.flag = "CTF{x}";
    s.visible = visible;
    return ChallengeFactory::create(s);
}

SolveRecord solve(const std::string& id, bool fb = false) {
    SolveRecord r;
    r.challengeId = id;
    r.playerId = "u_1";
    r.firstBlood = fb;
    return r;
}

bool has(const skills::SkillProfile& p, const std::string& b) {
    for (const auto& x : p.badges) if (x == b) return true;
    return false;
}
}  // namespace

TEST_CASE("Radar counts solved vs total per category and ignores hidden challenges", "[skills]") {
    auto a = make("a", Category::Web, Difficulty::Easy);
    auto b = make("b", Category::Web, Difficulty::Easy);
    auto h = make("h", Category::Web, Difficulty::Easy, false);
    auto c = make("c", Category::Crypto, Difficulty::Easy);
    std::vector<const Challenge*> all{a.get(), b.get(), h.get(), c.get()};

    auto p = skills::computeSkills({solve("a"), solve("a"), solve("h")}, all);
    REQUIRE(p.radar.size() == 6);
    CHECK(p.radar[0].category == Category::Web);
    CHECK(p.radar[0].total == 2);   // hidden one not counted
    CHECK(p.radar[0].solved == 1);  // duplicate and hidden ignored
    CHECK(p.radar[0].points == 100);
    CHECK(p.radar[1].total == 1);
    CHECK(p.radar[1].solved == 0);
}

TEST_CASE("Badges are derived from the solve history", "[skills]") {
    auto w1 = make("w1", Category::Web, Difficulty::Easy);
    auto w2 = make("w2", Category::Web, Difficulty::Hard);
    auto c1 = make("c1", Category::Crypto, Difficulty::Easy);
    auto f1 = make("f1", Category::Forensics, Difficulty::Easy);
    auto r1 = make("r1", Category::Reverse, Difficulty::Easy);
    std::vector<const Challenge*> all{w1.get(), w2.get(), c1.get(), f1.get(), r1.get()};

    CHECK(skills::computeSkills({}, all).badges.empty());

    auto one = skills::computeSkills({solve("w1", true)}, all);
    CHECK(has(one, "FIRST_BLOOD"));
    CHECK(has(one, "ON_THE_BOARD"));
    CHECK_FALSE(has(one, "MASTER_WEB"));

    auto web = skills::computeSkills({solve("w1"), solve("w2")}, all);
    CHECK(has(web, "MASTER_WEB"));
    CHECK(has(web, "HARD_HITTER"));
    CHECK_FALSE(has(web, "ALL_ROUNDER"));

    auto round = skills::computeSkills({solve("w1"), solve("c1"), solve("f1"), solve("r1")}, all);
    CHECK(has(round, "ALL_ROUNDER"));
}
