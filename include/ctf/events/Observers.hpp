#ifndef CTF_EVENTS_OBSERVERS_HPP
#define CTF_EVENTS_OBSERVERS_HPP

/// \file Observers.hpp
/// \brief Two concrete observers: ActivityFeed (bounded ring buffer of public-safe
///        messages for the UI) and EventLog (full ordered audit trail, persisted).

#include <cstddef>
#include <deque>
#include <vector>

#include "ctf/events/Event.hpp"
#include "ctf/events/IEventObserver.hpp"

namespace ctf::events {

/// A public-facing feed. Keeps the most recent \p capacity events; each is given a
/// monotonically increasing id so clients can poll with ?since=<id>.
class ActivityFeed final : public IEventObserver {
public:
    explicit ActivityFeed(std::size_t capacity = 200);

    void onEvent(const Event& event) override;

    /// Events with id strictly greater than \p sinceId, oldest first.
    std::vector<Event> since(long long sinceId) const;

    /// Id of the most recent event (0 if empty).
    long long latestId() const noexcept { return nextId_ - 1; }

private:
    std::size_t capacity_;
    long long nextId_ = 1;
    std::deque<std::pair<long long, Event>> ring_;
};

/// The complete, ordered audit trail. Never dropped; serialized by JsonStore.
class EventLog final : public IEventObserver {
public:
    void onEvent(const Event& event) override;

    const std::vector<Event>& entries() const noexcept { return entries_; }
    std::size_t size() const noexcept { return entries_.size(); }

private:
    std::vector<Event> entries_;
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_OBSERVERS_HPP
