#ifndef CTF_CORE_CHALLENGEGRAPH_HPP
#define CTF_CORE_CHALLENGEGRAPH_HPP

/// \file ChallengeGraph.hpp
/// \brief Free-function helpers over the challenge prerequisite graph: validate that
///        prerequisites reference known ids and contain no cycles (DFS), and compute
///        which prerequisites a team is still missing.
///
/// Kept as free functions (not a class) — pure graph algorithms over borrowed views
/// (as returned by Repository<Challenge>::all()). Demonstrates STL algorithms + lambdas.

#include <string>
#include <vector>

#include "ctf/core/Types.hpp"

namespace ctf {

class Challenge;

/// A non-owning view of all challenges (e.g. Repository<Challenge>::all()).
using ChallengeSpan = std::vector<const Challenge*>;

/// Validate the prerequisite edges of \p challenges:
///  - every prerequisite id must exist among the challenges, and
///  - the directed graph must be acyclic.
/// Throws ValidationException naming the offending id / cycle on failure.
void validatePrerequisiteGraph(const ChallengeSpan& challenges);

/// Would giving challenge \p forId the prerequisites \p prospectivePrereqs introduce a
/// cycle (or reference an unknown id)? Used by the admin editor to warn before saving.
bool wouldCreateCycle(const ChallengeSpan& challenges, const ChallengeId& forId,
                      const std::vector<ChallengeId>& prospectivePrereqs);

/// The prerequisite ids of \p challengeId not present in \p solvedIds.
std::vector<ChallengeId> missingPrerequisites(const ChallengeSpan& challenges,
                                              const ChallengeId& challengeId,
                                              const std::vector<ChallengeId>& solvedIds);

}  // namespace ctf

#endif  // CTF_CORE_CHALLENGEGRAPH_HPP
