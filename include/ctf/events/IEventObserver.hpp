#ifndef CTF_EVENTS_IEVENTOBSERVER_HPP
#define CTF_EVENTS_IEVENTOBSERVER_HPP

/// \file IEventObserver.hpp
/// \brief The Observer interface. Concrete observers (ActivityFeed, EventLog,
///        AntiCheatMonitor) react to events without the publisher knowing about them
///        — adding a new observer requires zero changes to CTFManager (PLAYBOOK §6.5).

#include "ctf/events/Event.hpp"

namespace ctf::events {

class IEventObserver {
public:
    virtual ~IEventObserver() = default;

    /// React to a published event. Must not throw (observers are notified in a loop).
    virtual void onEvent(const Event& event) = 0;
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_IEVENTOBSERVER_HPP
