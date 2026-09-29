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
#include <vector>

#include "ctf/events/Event.hpp"
#include "ctf/events/IEventObserver.hpp"

namespace ctf::events {

enum class AlertKind { FlagSharing, BurstSubmissions, SameWrongFlagMultiTeam };
enum class AlertStatus { Open, Dismissed };

const char* toString(AlertKind kind) noexcept;
const char* toString(AlertStatus status) noexcept;

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

    void onEvent(const Event& event) override;

    std::vector<Alert> alerts() const { return alerts_; }
    std::vector<Alert> openAlerts() const;
    void dismiss(const AlertId& alertId);

private:
    void raise(AlertKind kind, TimePoint at, std::string evidence, std::vector<TeamId> teams,
               std::optional<ChallengeId> challengeId);

    std::vector<Alert> alerts_;
    long long nextAlertId_ = 1;
    // sliding window of submission timestamps per team (burst detection)
    std::unordered_map<TeamId, std::deque<TimePoint>> submissionTimes_;
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_ANTICHEATMONITOR_HPP
