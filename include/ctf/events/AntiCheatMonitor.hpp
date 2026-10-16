#ifndef CTF_EVENTS_ANTICHEATMONITOR_HPP
#define CTF_EVENTS_ANTICHEATMONITOR_HPP

/// \file AntiCheatMonitor.hpp
/// \brief An observer that watches the event stream and raises anti-cheat alerts
///        (PLAYBOOK §6.7): flag sharing, submission bursts, and the same wrong flag
///        seen from many teams. Also a query interface for the admin alert panel.

#include <chrono>
#include <deque>
#include <optional>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "ctf/events/Event.hpp"
#include "ctf/events/IEventObserver.hpp"

namespace ctf::events {

enum class AlertKind {
    FlagSharing,
    BurstSubmissions,
    SameWrongFlagMultiTeam,
    FastSolve,         ///< solved far sooner than the challenge became available allows
    CorrelatedSolves,  ///< two teams repeatedly solve the same challenges within seconds
};
enum class AlertStatus { Open, Dismissed };

/// Admin-tunable thresholds for the behavioural rules. A value of 0 disables that rule.
struct AntiCheatConfig {
    int fastSolveEasySeconds = 3;       ///< EASY solved this soon after becoming available
    int fastSolveMediumSeconds = 12;
    int fastSolveHardSeconds = 25;
    int correlationWindowSeconds = 5;   ///< two solves of one challenge this close count as "together"
    int correlationMinChallenges = 3;   ///< ...and this many such challenges raise an alert

    bool operator==(const AntiCheatConfig& o) const noexcept {
        return fastSolveEasySeconds == o.fastSolveEasySeconds &&
               fastSolveMediumSeconds == o.fastSolveMediumSeconds &&
               fastSolveHardSeconds == o.fastSolveHardSeconds &&
               correlationWindowSeconds == o.correlationWindowSeconds &&
               correlationMinChallenges == o.correlationMinChallenges;
    }
};

/// What the monitor needs to know about one correct solve. Built by CTFManager.
struct SolveObservation {
    TeamId teamId;
    std::string teamName;
    ChallengeId challengeId;
    std::string challengeTitle;
    Difficulty difficulty = Difficulty::Easy;
    TimePoint availableSince{};  ///< when the team could first have started (latest prerequisite solve / event start)
    TimePoint at{};              ///< when it was solved
};

const char* toString(AlertKind kind) noexcept;
const char* toString(AlertStatus status) noexcept;

/// Parse the wire form ("FLAG_SHARING", "OPEN", ...). Throw ValidationException if unknown.
AlertKind alertKindFromString(const std::string& s);
AlertStatus alertStatusFromString(const std::string& s);

struct Alert {
    AlertId id;
    AlertKind kind;
    AlertStatus status = AlertStatus::Open;
    TimePoint at{};
    std::string evidence;             ///< human-readable, never contains a flag value
    std::vector<TeamId> teams;
    std::optional<ChallengeId> challengeId;
};

/// Consumes events and produces alerts. Pure logic (no I/O); thresholds match §6.7.
class AntiCheatMonitor final : public IEventObserver {
public:
    static constexpr int kBurstMax = 20;                  ///< submissions per team...
    static constexpr std::chrono::seconds kBurstWindow{60};  ///< ...per minute → burst
    static constexpr int kSameWrongFlagTeams = 3;         ///< distinct teams → shared-flag alert

    void onEvent(const Event& event) override;

    /// Record a wrong flag (as a hash, never the plaintext) so that the same wrong flag
    /// coming from kSameWrongFlagTeams distinct teams on one challenge raises an alert.
    /// Called directly by CTFManager so events remain flag-free.
    void noteWrongFlag(const TeamId& teamId, const ChallengeId& challengeId,
                       const std::string& wrongFlagHash, TimePoint at);

    std::vector<Alert> alerts() const { return alerts_; }
    std::vector<Alert> openAlerts() const;
    void dismiss(const AlertId& alertId);

    /// Behavioural checks on a correct solve (fast solve, correlated solves). Throws nothing.
    void noteSolve(const SolveObservation& solve);

    const AntiCheatConfig& config() const noexcept { return config_; }
    void setConfig(const AntiCheatConfig& config) noexcept { config_ = config; }

    /// Id the next raised alert will get (persisted so ids stay unique across restarts).
    long long nextAlertId() const noexcept { return nextAlertId_; }

    /// Restore previously saved alerts. Detection windows (burst / same-wrong-flag) are
    /// short-lived and intentionally start fresh.
    void restore(std::vector<Alert> alerts, long long nextAlertId);

private:
    void raise(AlertKind kind, TimePoint at, std::string evidence, std::vector<TeamId> teams,
               std::optional<ChallengeId> challengeId);

    std::vector<Alert> alerts_;
    long long nextAlertId_ = 1;
    // sliding window of submission timestamps per team (burst detection)
    std::unordered_map<TeamId, std::deque<TimePoint>> submissionTimes_;
    // challengeId + ":" + wrongFlagHash  ->  distinct teams that submitted it
    std::unordered_map<std::string, std::unordered_set<TeamId>> wrongFlagTeams_;
    std::unordered_set<std::string> sameWrongFlagAlerted_;  // keys already alerted (dedup)

    AntiCheatConfig config_;
    struct Solved {
        TeamId teamId;
        std::string teamName;
        TimePoint at;
    };
    // challengeId -> solves seen so far (correlation detection)
    std::unordered_map<ChallengeId, std::vector<Solved>> solvesByChallenge_;
    // "teamA|teamB" (ordered) -> challenges both solved within the window
    std::unordered_map<std::string, std::unordered_set<ChallengeId>> togetherChallenges_;
    std::unordered_set<std::string> correlationAlerted_;  // pairs already alerted (dedup)
    std::unordered_set<std::string> fastSolveAlerted_;    // "team|challenge" already alerted
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_ANTICHEATMONITOR_HPP
