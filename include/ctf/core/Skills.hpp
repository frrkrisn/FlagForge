#ifndef CTF_CORE_SKILLS_HPP
#define CTF_CORE_SKILLS_HPP

/// \file Skills.hpp
/// \brief Pure functions that turn a set of solves into a per-category skill radar and a
///        list of earned badges. Nothing is stored: both are derived on demand, so they can
///        never drift out of sync with the solve history.

#include <string>
#include <vector>

#include "ctf/core/Challenge.hpp"
#include "ctf/core/Team.hpp"
#include "ctf/core/Types.hpp"

namespace ctf::skills {

/// One spoke of the radar: how much of a category's visible content was solved.
struct SkillScore {
    Category category = Category::Misc;
    int solved = 0;  ///< challenges solved in this category
    int total = 0;   ///< visible challenges in this category
    int points = 0;  ///< base points of the solved challenges
};

struct SkillProfile {
    std::vector<SkillScore> radar;     ///< one entry per category, fixed order
    std::vector<std::string> badges;   ///< sorted, de-duplicated
};

/// Compute the radar and badges for \p solves against the visible challenges in \p all.
/// \p solves may be a whole team's records or just one player's.
SkillProfile computeSkills(const std::vector<SolveRecord>& solves,
                           const std::vector<const Challenge*>& all);

}  // namespace ctf::skills

#endif  // CTF_CORE_SKILLS_HPP
