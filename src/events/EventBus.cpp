#include "ctf/events/EventBus.hpp"

#include <algorithm>

namespace ctf::events {

void EventBus::subscribe(const std::shared_ptr<IEventObserver>& observer) {
    if (!observer) {
        return;
    }
    // Ignore duplicate subscriptions (compare by identity).
    for (const auto& weak : observers_) {
        if (weak.lock() == observer) {
            return;
        }
    }
    observers_.push_back(observer);
}

void EventBus::unsubscribe(const std::shared_ptr<IEventObserver>& observer) {
    observers_.erase(
        std::remove_if(observers_.begin(), observers_.end(),
                       [&](const std::weak_ptr<IEventObserver>& weak) {
                           auto locked = weak.lock();
                           return !locked || locked == observer;
                       }),
        observers_.end());
}

void EventBus::publish(const Event& event) {
    // Notify every live observer, pruning any that have expired.
    bool anyExpired = false;
    for (const auto& weak : observers_) {
        if (auto observer = weak.lock()) {
            observer->onEvent(event);
        } else {
            anyExpired = true;
        }
    }
    if (anyExpired) {
        observers_.erase(std::remove_if(observers_.begin(), observers_.end(),
                                        [](const std::weak_ptr<IEventObserver>& w) {
                                            return w.expired();
                                        }),
                         observers_.end());
    }
}

std::size_t EventBus::observerCount() const noexcept {
    return static_cast<std::size_t>(
        std::count_if(observers_.begin(), observers_.end(),
                      [](const std::weak_ptr<IEventObserver>& w) { return !w.expired(); }));
}

}  // namespace ctf::events
