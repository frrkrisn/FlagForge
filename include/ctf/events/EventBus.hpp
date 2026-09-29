#ifndef CTF_EVENTS_EVENTBUS_HPP
#define CTF_EVENTS_EVENTBUS_HPP

/// \file EventBus.hpp
/// \brief The Subject in the Observer pattern: observers subscribe, publishers call
///        publish(), and every live observer is notified. Observers are held as
///        non-owning weak_ptr, so an observer that is destroyed is simply skipped.

#include <memory>
#include <vector>

#include "ctf/events/Event.hpp"
#include "ctf/events/IEventObserver.hpp"

namespace ctf::events {

class EventBus {
public:
    EventBus() = default;

    /// Register an observer (non-owning). Duplicate subscriptions are ignored.
    void subscribe(const std::shared_ptr<IEventObserver>& observer);

    /// Remove an observer (by identity). Missing observers are ignored.
    void unsubscribe(const std::shared_ptr<IEventObserver>& observer);

    /// Notify every live observer of \p event, pruning any that have expired.
    void publish(const Event& event);

    std::size_t observerCount() const noexcept;

private:
    std::vector<std::weak_ptr<IEventObserver>> observers_;
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_EVENTBUS_HPP
