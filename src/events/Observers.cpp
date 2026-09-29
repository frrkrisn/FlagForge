#include "ctf/events/Observers.hpp"

namespace ctf::events {

// --- ActivityFeed -----------------------------------------------------------
ActivityFeed::ActivityFeed(std::size_t capacity) : capacity_(capacity == 0 ? 1 : capacity) {}

void ActivityFeed::onEvent(const Event& event) {
    ring_.emplace_back(nextId_++, event);
    while (ring_.size() > capacity_) {
        ring_.pop_front();
    }
}

std::vector<Event> ActivityFeed::since(long long sinceId) const {
    std::vector<Event> out;
    for (const auto& [id, event] : ring_) {
        if (id > sinceId) {
            out.push_back(event);
        }
    }
    return out;
}

// --- EventLog ---------------------------------------------------------------
void EventLog::onEvent(const Event& event) {
    entries_.push_back(event);
}

}  // namespace ctf::events
