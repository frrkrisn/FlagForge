#ifndef CTF_CORE_CHALLENGEGRAPH_HPP
#define CTF_CORE_CHALLENGEGRAPH_HPP

/// \file ChallengeGraph.hpp
/// \brief Free-function helpers over the challenge prerequisite graph: validate that
///        prerequisites reference known ids and contain no cycles (DFS), and test
///        whether a team has unlocked a challenge.
///
/// Kept as free functions (not a class) — they are pure graph algorithms over data
/// the caller owns, and demonstrate STL algorithms + lambdas.

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "ctf/core/Types.hpp"

namespace ctf {

class Challenge;

/// Validate the prerequisite edges of \p challenges:
///  - every prerequisite id must exist in the map, and
///  - the directed graph must be acyclic.
/// Throws ValidationException naming the offending id / cycle on failure.
void validatePrerequisiteGraph(
    const std::unordered_map<ChallengeId, std::unique_ptr<Challenge>>& challenges);

/// Would adding \p prospectivePrereqs to challenge \p forId introduce a cycle?
/// Used by the admin editor to warn before saving (FR/R-34).
bool wouldCreateCycle(
    const std::unordered_map<ChallengeId, std::unique_ptr<Challenge>>& challenges,
    const ChallengeId& forId, const std::vector<ChallengeId>& prospectivePrereqs);

/// The prerequisite ids of \p challengeId not present in \p solvedIds.
std::vector<ChallengeId> missingPrerequisites(
    const std::unordered_map<ChallengeId, std::unique_ptr<Challenge>>& challenges,
    const ChallengeId& challengeId, const std::vector<ChallengeId>& solvedIds);

}  // namespace ctf

#endif  // CTF_CORE_CHALLENGEGRAPH_HPP
