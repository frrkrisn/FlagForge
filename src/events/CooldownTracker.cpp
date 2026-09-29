#include "ctf/events/CooldownTracker.hpp"

#include <cmath>
#include <functional>

namespace ctf::events {

std::size_t CooldownTracker::KeyHash::operator()(const Key& k) const noexcept {
    const std::size_t h1 = std::hash<std::string>{}(k.team);
    const std::size_t h2 = std::hash<std::string>{}(k.challenge);
    return h1 ^ (h2 + 0x9e3779b97f4a7c15ULL + (h1 << 6) + (h1 >> 2));
}

bool CooldownTracker::isOnCooldown(const TeamId& teamId, const ChallengeId& challengeId,
                                   TimePoint now, int& outSecondsLeft) const {
    outSecondsLeft = 0;
    auto it = state_.find(Key{teamId, challengeId});
    if (it == state_.end()) {
        return false;
    }
    const auto& st = it->second;
    if (st.cooldownUntil > now) {
        const std::chrono::duration<double> diff = st.cooldownUntil - now;
        outSecondsLeft = static_cast<int>(std::ceil(diff.count()));
        return true;
    }
    return false;
}

bool CooldownTracker::recordWrong(const TeamId& teamId, const ChallengeId& challengeId,
                                  TimePoint now) {
    State& st = state_[Key{teamId, challengeId}];

    // Drop wrong attempts older than the sliding window.
    const TimePoint cutoff = now - kWindow;
    while (!st.wrongTimes.empty() && st.wrongTimes.front() < cutoff) {
        st.wrongTimes.pop_front();
    }
    st.wrongTimes.push_back(now);

    if (static_cast<int>(st.wrongTimes.size()) >= kMaxWrong) {
        st.cooldownUntil = now + kCooldown;
        st.wrongTimes.clear();  // reset the counter after triggering
        return true;
    }
    return false;
}

int CooldownTracker::recentWrongCount(const TeamId& teamId, const ChallengeId& challengeId,
                                      TimePoint now) const {
    auto it = state_.find(Key{teamId, challengeId});
    if (it == state_.end()) {
        return 0;
    }
    const TimePoint cutoff = now - kWindow;
    int count = 0;
    for (const TimePoint& t : it->second.wrongTimes) {
        if (t >= cutoff) {
            ++count;
        }
    }
    return count;
}

void CooldownTracker::clear(const TeamId& teamId, const ChallengeId& challengeId) {
    state_.erase(Key{teamId, challengeId});
}

}  // namespace ctf::events
