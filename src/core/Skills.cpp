#include "ctf/core/Skills.hpp"

#include <algorithm>
#include <array>
#include <map>
#include <set>

namespace ctf::skills {

namespace {
constexpr std::array<Category, 6> kCategories = {Category::Web,     Category::Crypto, Category::Forensics,
                                                 Category::Reverse, Category::Pwn,    Category::Misc};
}  // namespace

SkillProfile computeSkills(const std::vector<SolveRecord>& solves,
                           const std::vector<const Challenge*>& all) {
    std::map<ChallengeId, const Challenge*> byId;
    for (const Challenge* c : all) {
        if (c != nullptr && c->visible()) byId[c->id()] = c;
    }

    SkillProfile out;
    for (Category cat : kCategories) {
        SkillScore s;
        s.category = cat;
        for (const auto& [id, c] : byId) {
            if (c->category() == cat) ++s.total;
        }
        out.radar.push_back(s);
    }
    auto spoke = [&](Category cat) -> SkillScore& {
        return *std::find_if(out.radar.begin(), out.radar.end(),
                             [&](const SkillScore& s) { return s.category == cat; });
    };

    std::set<ChallengeId> counted;
    std::set<std::string> badges;
    int solvedTotal = 0;
    bool hard = false;
    for (const SolveRecord& r : solves) {
        if (r.firstBlood) badges.insert("FIRST_BLOOD");
        auto it = byId.find(r.challengeId);
        if (it == byId.end() || !counted.insert(r.challengeId).second) continue;
        const Challenge& c = *it->second;
        SkillScore& s = spoke(c.category());
        ++s.solved;
        s.points += c.basePoints();
        ++solvedTotal;
        if (c.difficulty() == Difficulty::Hard) hard = true;
    }

    int categoriesTouched = 0;
    for (const SkillScore& s : out.radar) {
        if (s.solved > 0) ++categoriesTouched;
        if (s.total >= 2 && s.solved == s.total) badges.insert(std::string("MASTER_") + toString(s.category));
    }
    if (categoriesTouched >= 4) badges.insert("ALL_ROUNDER");
    if (hard) badges.insert("HARD_HITTER");
    if (solvedTotal >= 10) badges.insert("VETERAN");
    if (solvedTotal >= 1) badges.insert("ON_THE_BOARD");

    out.badges.assign(badges.begin(), badges.end());
    return out;
}

}  // namespace ctf::skills
