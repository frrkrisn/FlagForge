#ifndef CTF_EVENTS_EVENT_HPP
#define CTF_EVENTS_EVENT_HPP

/// \file Event.hpp
/// \brief The typed domain event published on the EventBus (Observer pattern).

#include <optional>
#include <string>

#include "ctf/core/Types.hpp"

namespace ctf::events {

/// Every kind of thing observers may react to (PLAYBOOK §6.5).
enum class EventType {
    Solve,
    FirstBlood,
    WrongAttempt,
    HintUnlocked,
    TeamCreated,
    TeamJoined,
    EventStarted,
    EventPaused,
    EventResumed,
    EventEnded,
    FlagSharing,
    CooldownTriggered,
    Announcement,
};

const char* toString(EventType type) noexcept;

/// An immutable notification. Optional ids are set when relevant to the event.
struct Event {
    EventType type;
    TimePoint timestamp;
    std::optional<TeamId> teamId;
    std::optional<TeamId> otherTeamId;   ///< e.g. the team whose flag was shared
    std::optional<ChallengeId> challengeId;
    std::string message;                 ///< public-safe, never contains a flag
    int points = 0;                      ///< awarded points, when applicable
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_EVENT_HPP
