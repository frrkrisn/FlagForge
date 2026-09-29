#include "ctf/scoring/Scoreboard.hpp"

#include <algorithm>
#include <unordered_map>

namespace ctf::scoring {

namespace {

const Challenge* findChallenge(const ChallengeView& challenges, const ChallengeId& id) {
    for (const Challenge* c : challenges) {
        if (c != nullptr && c->id() == id) {
            return c;
        }
    }
    return nullptr;
}

std::unordered_map<ChallengeId, int> countsAt(const TeamView& teams, TimePoint at) {
    std::unordered_map<ChallengeId, int> counts;
    for (const Team* t : teams) {
        if (!t) continue;
        for (const SolveRecord& s : t->solves()) {
            if (s.timestamp <= at) {
                ++counts[s.challengeId];
            }
        }
    }
    return counts;
}

/// Derived score: current value of each solved challenge (+ first-blood bonus baked
/// into the strategy) minus hint costs, considering only records at or before `at`.
int scoreWith(const Team& team, const std::unordered_map<ChallengeId, int>& counts,
              const ChallengeView& challenges, TimePoint at) {
    int score = 0;
    for (const SolveRecord& s : team.solves()) {
        if (s.timestamp > at) continue;
        if (const Challenge* c = findChallenge(challenges, s.challengeId)) {
            auto it = counts.find(s.challengeId);
            const int solveCount = (it == counts.end()) ? 0 : it->second;
            score += c->currentPoints(solveCount, s.firstBlood);
        }
    }
    for (const HintUnlock& h : team.hintUnlocks()) {
        if (h.timestamp <= at) {
            score -= h.cost;
        }
    }
    return score;
}

/// Build ranked rows as of `at` (rank assigned; rankDelta left at 0).
std::vector<RankRow> buildRows(const TeamView& teams, const ChallengeView& challenges,
                               TimePoint at) {
    const auto counts = countsAt(teams, at);
    std::vector<RankRow> rows;
    rows.reserve(teams.size());

    for (const Team* t : teams) {
        if (!t) continue;
        RankRow row;
        row.teamId = t->id();
        row.teamName = t->name();
        row.avatarSeed = t->name();
        row.score = scoreWith(*t, counts, challenges, at);

        TimePoint last{};
        for (const SolveRecord& s : t->solves()) {
            if (s.timestamp > at) continue;
            ++row.solves;
            if (s.timestamp > last) last = s.timestamp;
            if (const Challenge* c = findChallenge(challenges, s.challengeId)) {
                ++row.categorySolves[c->category()];
            }
        }
        row.lastSolveAt = last;
        rows.push_back(std::move(row));
    }

    // Rank: score desc, then earliest last-scoring-solve, then name asc.
    std::sort(rows.begin(), rows.end(), [](const RankRow& a, const RankRow& b) {
        if (a.score != b.score) return a.score > b.score;
        if (a.lastSolveAt != b.lastSolveAt) return a.lastSolveAt < b.lastSolveAt;
        return a.teamName < b.teamName;
    });
    for (std::size_t i = 0; i < rows.size(); ++i) {
        rows[i].rank = static_cast<int>(i + 1);
    }
    return rows;
}

}  // namespace

std::unordered_map<ChallengeId, int> Scoreboard::solveCounts(const TeamView& teams,
                                                             TimePoint at) const {
    return countsAt(teams, at);
}

int Scoreboard::scoreOf(const Team& team, const TeamView& allTeams,
                        const ChallengeView& challenges, TimePoint at) const {
    return scoreWith(team, countsAt(allTeams, at), challenges, at);
}

std::vector<RankRow> Scoreboard::compute(const TeamView& teams, const ChallengeView& challenges,
                                         TimePoint now) {
    std::vector<RankRow> rows = buildRows(teams, challenges, now);
    for (RankRow& row : rows) {
        auto it = previousRanks_.find(row.teamId);
        row.rankDelta = (it == previousRanks_.end()) ? 0 : (it->second - row.rank);
    }
    previousRanks_.clear();
    for (const RankRow& row : rows) {
        previousRanks_[row.teamId] = row.rank;
    }
    return rows;
}

ScoreboardSnapshot Scoreboard::snapshotAt(const TeamView& teams, const ChallengeView& challenges,
                                          TimePoint at) const {
    ScoreboardSnapshot snap;
    snap.at = at;
    snap.rows = buildRows(teams, challenges, at);
    return snap;
}

std::vector<TeamTimeline> Scoreboard::timeline(const TeamView& teams,
                                               const ChallengeView& challenges, int topN,
                                               TimePoint now) const {
    const std::vector<RankRow> ranked = buildRows(teams, challenges, now);
    const std::size_t limit =
        std::min<std::size_t>(static_cast<std::size_t>(std::max(0, topN)), ranked.size());

    std::vector<TeamTimeline> out;
    out.reserve(limit);
    for (std::size_t i = 0; i < limit; ++i) {
        const Team* team = nullptr;
        for (const Team* t : teams) {
            if (t && t->id() == ranked[i].teamId) {
                team = t;
                break;
            }
        }
        if (!team) continue;

        TeamTimeline tl;
        tl.teamId = team->id();
        tl.teamName = team->name();

        // Score changes at each solve and each hint unlock.
        std::vector<TimePoint> times;
        for (const SolveRecord& s : team->solves()) {
            if (s.timestamp <= now) times.push_back(s.timestamp);
        }
        for (const HintUnlock& h : team->hintUnlocks()) {
            if (h.timestamp <= now) times.push_back(h.timestamp);
        }
        std::sort(times.begin(), times.end());
        times.erase(std::unique(times.begin(), times.end()), times.end());

        for (TimePoint t : times) {
            tl.points.push_back(TimelinePoint{t, scoreWith(*team, countsAt(teams, t), challenges, t)});
        }
        out.push_back(std::move(tl));
    }
    return out;
}

}  // namespace ctf::scoring
