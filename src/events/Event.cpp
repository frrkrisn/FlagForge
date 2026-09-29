#include "ctf/events/Event.hpp"

namespace ctf::events {

const char* toString(EventType type) noexcept {
    switch (type) {
        case EventType::Solve: return "SOLVE";
        case EventType::FirstBlood: return "FIRST_BLOOD";
        case EventType::WrongAttempt: return "WRONG_ATTEMPT";
        case EventType::HintUnlocked: return "HINT_UNLOCKED";
        case EventType::TeamCreated: return "TEAM_CREATED";
        case EventType::TeamJoined: return "TEAM_JOINED";
        case EventType::EventStarted: return "EVENT_STARTED";
        case EventType::EventPaused: return "EVENT_PAUSED";
        case EventType::EventResumed: return "EVENT_RESUMED";
        case EventType::EventEnded: return "EVENT_ENDED";
        case EventType::FlagSharing: return "FLAG_SHARING";
        case EventType::CooldownTriggered: return "COOLDOWN_TRIGGERED";
        case EventType::Announcement: return "ANNOUNCEMENT";
    }
    return "SOLVE";
}

}  // namespace ctf::events
