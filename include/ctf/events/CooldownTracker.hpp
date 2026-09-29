#ifndef CTF_EVENTS_COOLDOWNTRACKER_HPP
#define CTF_EVENTS_COOLDOWNTRACKER_HPP

/// \file CooldownTracker.hpp
/// \brief Per-team, per-challenge wrong-attempt rate limiting (PLAYBOOK §6.7):
///        after kMaxWrong wrong attempts within kWindow, the team is on cooldown for
///        that challenge for kCooldown. Time comes from an injected IClock.

#include <chrono>
#include <deque>
#include <string>
#include <unordered_map>

#include "ctf/core/Types.hpp"

namespace ctf::events {

class CooldownTracker {
public:
    static constexpr int kMaxWrong = 5;                        ///< wrong attempts...
    static constexpr std::chrono::seconds kWindow{60};         ///< ...within this window...
    static constexpr std::chrono::seconds kCooldown{30};       ///< ...trigger this cooldown.

    /// Is (team, challenge) currently on cooldown at \p now? If so, \p outSecondsLeft
    /// receives the remaining seconds.
    bool isOnCooldown(const TeamId& teamId, const ChallengeId& challengeId, TimePoint now,
                      int& outSecondsLeft) const;

    /// Record a wrong attempt. Returns true if this attempt *triggered* a new cooldown.
    bool recordWrong(const TeamId& teamId, const ChallengeId& challengeId, TimePoint now);

    /// Clear state for a (team, challenge) — e.g. after a correct solve.
    void clear(const TeamId& teamId, const ChallengeId& challengeId);

private:
    struct Key {
        TeamId team;
        ChallengeId challenge;
        bool operator==(const Key& o) const noexcept {
            return team == o.team && challenge == o.challenge;
        }
    };
    struct KeyHash {
        std::size_t operator()(const Key& k) const noexcept;
    };
    struct State {
        std::deque<TimePoint> wrongTimes;  ///< recent wrong-attempt timestamps
        TimePoint cooldownUntil{};         ///< epoch if not on cooldown
    };

    std::unordered_map<Key, State, KeyHash> state_;
};

}  // namespace ctf::events

#endif  // CTF_EVENTS_COOLDOWNTRACKER_HPP
