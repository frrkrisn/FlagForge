#include "ctf/core/ChallengeGraph.hpp"

#include <algorithm>
#include <functional>
#include <unordered_map>
#include <unordered_set>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Challenge.hpp"

namespace ctf {

namespace {

/// Build id → prerequisites adjacency from a challenge view.
std::unordered_map<ChallengeId, std::vector<ChallengeId>> buildAdjacency(
    const ChallengeSpan& challenges) {
    std::unordered_map<ChallengeId, std::vector<ChallengeId>> adj;
    adj.reserve(challenges.size());
    for (const Challenge* c : challenges) {
        if (c != nullptr) {
            adj[c->id()] = c->prerequisites();
        }
    }
    return adj;
}

/// DFS-based cycle detection over the prerequisite edges, starting at \p start.
/// \p visiting tracks the current recursion stack (grey nodes).
bool hasCycleFrom(const ChallengeId& start,
                  const std::unordered_map<ChallengeId, std::vector<ChallengeId>>& adj,
                  std::unordered_set<ChallengeId>& visiting,
                  std::unordered_set<ChallengeId>& done) {
    if (done.count(start)) return false;
    if (!visiting.insert(start).second) return true;  // back-edge → cycle

    auto it = adj.find(start);
    if (it != adj.end()) {
        for (const ChallengeId& next : it->second) {
            if (hasCycleFrom(next, adj, visiting, done)) return true;
        }
    }
    visiting.erase(start);
    done.insert(start);
    return false;
}

}  // namespace

void validatePrerequisiteGraph(const ChallengeSpan& challenges) {
    const auto adj = buildAdjacency(challenges);

    // 1) Every prerequisite must reference a known challenge.
    for (const auto& [id, prereqs] : adj) {
        for (const ChallengeId& p : prereqs) {
            if (adj.find(p) == adj.end()) {
                throw ValidationException("Challenge '" + id + "' has unknown prerequisite '" +
                                          p + "'");
            }
        }
    }

    // 2) The graph must be acyclic.
    std::unordered_set<ChallengeId> visiting;
    std::unordered_set<ChallengeId> done;
    for (const auto& [id, _] : adj) {
        if (hasCycleFrom(id, adj, visiting, done)) {
            throw ValidationException("Prerequisite cycle detected involving challenge '" + id +
                                      "'");
        }
    }
}

bool wouldCreateCycle(const ChallengeSpan& challenges, const ChallengeId& forId,
                      const std::vector<ChallengeId>& prospectivePrereqs) {
    auto adj = buildAdjacency(challenges);
    adj[forId] = prospectivePrereqs;  // apply the hypothetical edges

    // Unknown id among the prospective prerequisites counts as invalid → treat as "cycle".
    for (const ChallengeId& p : prospectivePrereqs) {
        if (adj.find(p) == adj.end()) return true;
    }

    std::unordered_set<ChallengeId> visiting;
    std::unordered_set<ChallengeId> done;
    return hasCycleFrom(forId, adj, visiting, done);
}

std::vector<ChallengeId> missingPrerequisites(const ChallengeSpan& challenges,
                                              const ChallengeId& challengeId,
                                              const std::vector<ChallengeId>& solvedIds) {
    std::vector<ChallengeId> missing;
    auto challengeIt = std::find_if(challenges.begin(), challenges.end(), [&](const Challenge* c) {
        return c != nullptr && c->id() == challengeId;
    });
    if (challengeIt == challenges.end()) {
        return missing;
    }
    for (const ChallengeId& prereq : (*challengeIt)->prerequisites()) {
        if (std::find(solvedIds.begin(), solvedIds.end(), prereq) == solvedIds.end()) {
            missing.push_back(prereq);
        }
    }
    return missing;
}

}  // namespace ctf
