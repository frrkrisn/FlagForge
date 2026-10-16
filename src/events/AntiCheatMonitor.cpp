#include "ctf/events/AntiCheatMonitor.hpp"

#include <algorithm>
#include <cstdlib>
#include <string>

#include "ctf/Exceptions.hpp"

namespace ctf::events {

const char* toString(AlertKind kind) noexcept {
    switch (kind) {
        case AlertKind::FlagSharing: return "FLAG_SHARING";
        case AlertKind::BurstSubmissions: return "BURST_SUBMISSIONS";
        case AlertKind::SameWrongFlagMultiTeam: return "SAME_WRONG_FLAG_MULTI_TEAM";
        case AlertKind::FastSolve: return "FAST_SOLVE";
        case AlertKind::CorrelatedSolves: return "CORRELATED_SOLVES";
    }
    return "FLAG_SHARING";
}

const char* toString(AlertStatus status) noexcept {
    switch (status) {
        case AlertStatus::Open: return "OPEN";
        case AlertStatus::Dismissed: return "DISMISSED";
    }
    return "OPEN";
}

AlertKind alertKindFromString(const std::string& s) {
    if (s == "FLAG_SHARING") return AlertKind::FlagSharing;
    if (s == "BURST_SUBMISSIONS") return AlertKind::BurstSubmissions;
    if (s == "SAME_WRONG_FLAG_MULTI_TEAM") return AlertKind::SameWrongFlagMultiTeam;
    if (s == "FAST_SOLVE") return AlertKind::FastSolve;
    if (s == "CORRELATED_SOLVES") return AlertKind::CorrelatedSolves;
    throw ValidationException("Unknown alert kind: " + s);
}

void AntiCheatMonitor::noteSolve(const SolveObservation& solve) {
    using std::chrono::duration_cast;
    using std::chrono::seconds;

    // --- Rule 1: solved much sooner than the challenge became available allows ----------------
    const int threshold = solve.difficulty == Difficulty::Easy     ? config_.fastSolveEasySeconds
                          : solve.difficulty == Difficulty::Medium ? config_.fastSolveMediumSeconds
                                                                   : config_.fastSolveHardSeconds;
    if (threshold > 0) {
        const long long took = std::max<long long>(0, duration_cast<seconds>(solve.at - solve.availableSince).count());
        const std::string key = solve.teamId + "|" + solve.challengeId;
        if (took < threshold && fastSolveAlerted_.insert(key).second) {
            raise(AlertKind::FastSolve, solve.at,
                  solve.teamName + " solved \"" + solve.challengeTitle + "\" (" + toString(solve.difficulty) + ") " +
                      std::to_string(took) + "s after it became available (limit " + std::to_string(threshold) + "s)",
                  {solve.teamId}, solve.challengeId);
        }
    }

    // --- Rule 2: two teams repeatedly solve the same challenges within seconds ----------------
    auto& earlier = solvesByChallenge_[solve.challengeId];
    if (config_.correlationWindowSeconds > 0 && config_.correlationMinChallenges > 0) {
        for (const Solved& other : earlier) {
            if (other.teamId == solve.teamId) continue;
            const long long gap = std::llabs(duration_cast<seconds>(solve.at - other.at).count());
            if (gap > config_.correlationWindowSeconds) continue;

            const bool ordered = other.teamId < solve.teamId;
            const std::string pair = ordered ? other.teamId + "|" + solve.teamId : solve.teamId + "|" + other.teamId;
            auto& together = togetherChallenges_[pair];
            together.insert(solve.challengeId);
            if (static_cast<int>(together.size()) >= config_.correlationMinChallenges &&
                correlationAlerted_.insert(pair).second) {
                raise(AlertKind::CorrelatedSolves, solve.at,
                      other.teamName + " and " + solve.teamName + " solved " + std::to_string(together.size()) +
                          " challenges within " + std::to_string(config_.correlationWindowSeconds) + "s of each other",
                      {other.teamId, solve.teamId}, solve.challengeId);
            }
        }
    }
    earlier.push_back(Solved{solve.teamId, solve.teamName, solve.at});
}

AlertStatus alertStatusFromString(const std::string& s) {
    if (s == "OPEN") return AlertStatus::Open;
    if (s == "DISMISSED") return AlertStatus::Dismissed;
    throw ValidationException("Unknown alert status: " + s);
}

void AntiCheatMonitor::restore(std::vector<Alert> alerts, long long nextAlertId) {
    alerts_ = std::move(alerts);
    long long next = nextAlertId;
    for (const Alert& a : alerts_) {
        // ids look like "al_<n>"; never hand out one that already exists
        if (a.id.rfind("al_", 0) == 0) {
            const long long n = std::atoll(a.id.c_str() + 3);
            if (n >= next) next = n + 1;
        }
    }
    nextAlertId_ = next < 1 ? 1 : next;
}

void AntiCheatMonitor::raise(AlertKind kind, TimePoint at, std::string evidence,
                             std::vector<TeamId> teams, std::optional<ChallengeId> challengeId) {
    Alert alert;
    alert.id = "al_" + std::to_string(nextAlertId_++);
    alert.kind = kind;
    alert.status = AlertStatus::Open;
    alert.at = at;
    alert.evidence = std::move(evidence);
    alert.teams = std::move(teams);
    alert.challengeId = std::move(challengeId);
    alerts_.push_back(std::move(alert));
}

void AntiCheatMonitor::onEvent(const Event& event) {
    // A submission = a solve, a wrong attempt, or a rejected shared flag.
    const bool isSubmission = event.type == EventType::Solve ||
                              event.type == EventType::WrongAttempt ||
                              event.type == EventType::FlagSharing;

    if (event.type == EventType::FlagSharing) {
        std::vector<TeamId> teams;
        if (event.teamId) teams.push_back(*event.teamId);
        if (event.otherTeamId) teams.push_back(*event.otherTeamId);
        raise(AlertKind::FlagSharing, event.timestamp, event.message, std::move(teams),
              event.challengeId);
    }

    if (isSubmission && event.teamId) {
        auto& times = submissionTimes_[*event.teamId];
        const TimePoint cutoff = event.timestamp - kBurstWindow;
        while (!times.empty() && times.front() < cutoff) {
            times.pop_front();
        }
        const bool wasUnderLimit = static_cast<int>(times.size()) <= kBurstMax;
        times.push_back(event.timestamp);
        if (wasUnderLimit && static_cast<int>(times.size()) > kBurstMax) {
            raise(AlertKind::BurstSubmissions, event.timestamp,
                  *event.teamId + " made more than " + std::to_string(kBurstMax) +
                      " submissions in under a minute",
                  {*event.teamId}, std::nullopt);
        }
    }
}

void AntiCheatMonitor::noteWrongFlag(const TeamId& teamId, const ChallengeId& challengeId,
                                     const std::string& wrongFlagHash, TimePoint at) {
    const std::string key = challengeId + ":" + wrongFlagHash;
    auto& teams = wrongFlagTeams_[key];
    teams.insert(teamId);
    if (static_cast<int>(teams.size()) >= kSameWrongFlagTeams &&
        sameWrongFlagAlerted_.insert(key).second) {
        raise(AlertKind::SameWrongFlagMultiTeam, at,
              std::to_string(teams.size()) +
                  " teams submitted the same wrong flag on challenge " + challengeId,
              std::vector<TeamId>(teams.begin(), teams.end()), challengeId);
    }
}

std::vector<Alert> AntiCheatMonitor::openAlerts() const {
    std::vector<Alert> out;
    std::copy_if(alerts_.begin(), alerts_.end(), std::back_inserter(out),
                 [](const Alert& a) { return a.status == AlertStatus::Open; });
    return out;
}

void AntiCheatMonitor::dismiss(const AlertId& alertId) {
    for (Alert& a : alerts_) {
        if (a.id == alertId) {
            a.status = AlertStatus::Dismissed;
            return;
        }
    }
}

}  // namespace ctf::events
