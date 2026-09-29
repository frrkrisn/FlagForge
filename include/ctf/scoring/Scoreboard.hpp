#ifndef CTF_SCORING_SCOREBOARD_HPP
#define CTF_SCORING_SCOREBOARD_HPP

/// \file Scoreboard.hpp
/// \brief Derives team scores and rankings from solve/hint records (scores are never
///        stored — PLAYBOOK §6.1), applies the tie-break rule, produces a freeze
///        snapshot, and replays solves into a per-team timeline.

#include <map>
#include <unordered_map>
#include <vector>

#include "ctf/core/Challenge.hpp"
#include "ctf/core/Team.hpp"
#include "ctf/core/Types.hpp"

namespace ctf::scoring {

/// One row of the ranked board.
struct RankRow {
    int rank = 0;
    TeamId teamId;
    std::string teamName;
    std::string avatarSeed;
    int score = 0;
    int solves = 0;
    TimePoint lastSolveAt{};
    std::map<Category, int> categorySolves;
    int rankDelta = 0;  ///< previous rank − current rank (+ = moved up); 0 if new/unchanged
};

/// A board frozen at a point in time (PLAYBOOK §6.6).
struct ScoreboardSnapshot {
    TimePoint at{};
    std::vector<RankRow> rows;
};

struct TimelinePoint {
    TimePoint t{};
    int score = 0;
};

struct TeamTimeline {
    TeamId teamId;
    std::string teamName;
    std::vector<TimelinePoint> points;
};

/// Inputs are borrowed (non-owning) pointers assembled by CTFManager under its lock.
using TeamView = std::vector<const Team*>;
using ChallengeView = std::vector<const Challenge*>;

/// Stateful only in that it remembers the previous ranking to compute rankDelta.
class Scoreboard {
public:
    /// Live ranking as of \p now. Updates the remembered ranks (drives rankDelta).
    std::vector<RankRow> compute(const TeamView& teams, const ChallengeView& challenges,
                                 TimePoint now);

    /// Snapshot considering only solves/unlocks at or before \p at. Does not affect
    /// the remembered live ranks.
    ScoreboardSnapshot snapshotAt(const TeamView& teams, const ChallengeView& challenges,
                                  TimePoint at) const;

    /// For the top \p topN teams (by live score), the cumulative score over time.
    std::vector<TeamTimeline> timeline(const TeamView& teams, const ChallengeView& challenges,
                                       int topN, TimePoint now) const;

    /// Score of one team as of \p at (sum of current challenge values for its solves,
    /// plus first-blood bonuses, minus hint costs). Public for unit testing.
    int scoreOf(const Team& team, const ChallengeView& challenges, TimePoint at) const;

private:
    std::unordered_map<TeamId, int> previousRanks_;
};

}  // namespace ctf::scoring

#endif  // CTF_SCORING_SCOREBOARD_HPP
