#include "ctf/events/AntiCheatMonitor.hpp"

#include <algorithm>
#include <string>

namespace ctf::events {

const char* toString(AlertKind kind) noexcept {
    switch (kind) {
        case AlertKind::FlagSharing: return "FLAG_SHARING";
        case AlertKind::BurstSubmissions: return "BURST_SUBMISSIONS";
        case AlertKind::SameWrongFlagMultiTeam: return "SAME_WRONG_FLAG_MULTI_TEAM";
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
