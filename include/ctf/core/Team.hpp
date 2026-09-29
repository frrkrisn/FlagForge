#ifndef CTF_CORE_TEAM_HPP
#define CTF_CORE_TEAM_HPP

/// \file Team.hpp
/// \brief A team of players. Demonstrates: encapsulation (records are private and
///        only mutated through methods), a static constant (kMaxSize), operator
///        overloading (operator<, operator+=) and a friend operator<<.
///
/// Scores are NOT stored on the team — they are *derived* by the Scoreboard from the
/// solve/hint records held here (PLAYBOOK §6.1). A Team owns its records (composition)
/// but only references its Players by id (aggregation).

#include <cstddef>
#include <iosfwd>
#include <set>
#include <string>
#include <vector>

#include "ctf/core/Types.hpp"

namespace ctf {

/// A single scoring solve by a team (what was solved, by whom, when).
struct SolveRecord {
    ChallengeId challengeId;
    UserId playerId;
    TimePoint timestamp;
    bool firstBlood = false;
};

/// A hint unlock (a negative contribution to the derived score).
struct HintUnlock {
    ChallengeId challengeId;
    HintId hintId;
    int cost = 0;
    TimePoint timestamp;
};

class Team {
public:
    /// Maximum members per team (FR-03). Static class constant.
    static constexpr std::size_t kMaxSize = 4;

    Team(TeamId id, std::string name, UserId captainId, std::string inviteCode);

    // --- identity / membership ---
    const TeamId& id() const noexcept { return id_; }
    const std::string& name() const noexcept { return name_; }
    const UserId& captainId() const noexcept { return captainId_; }
    const std::string& inviteCode() const noexcept { return inviteCode_; }
    const std::vector<UserId>& memberIds() const noexcept { return memberIds_; }

    bool isFull() const noexcept { return memberIds_.size() >= kMaxSize; }
    bool hasMember(const UserId& userId) const noexcept;
    std::size_t size() const noexcept { return memberIds_.size(); }

    /// Add a member. Throws TeamFullException if already at capacity.
    void addMember(const UserId& userId);
    /// Remove a member. If the captain is removed, captaincy passes to the next member.
    void removeMember(const UserId& userId);
    void setCaptain(const UserId& userId);
    void regenerateInviteCode(std::string newCode);

    // --- solve / hint records (encapsulated) ---
    bool hasSolved(const ChallengeId& challengeId) const noexcept;
    bool hasUnlockedHint(const ChallengeId& challengeId, const HintId& hintId) const noexcept;
    void recordSolve(const SolveRecord& record);      // throws on duplicate
    void recordHintUnlock(const HintUnlock& unlock);  // idempotent per (challenge,hint)

    const std::vector<SolveRecord>& solves() const noexcept { return solved_; }
    const std::vector<HintUnlock>& hintUnlocks() const noexcept { return hintUnlocks_; }

    // --- badges ---
    const std::set<std::string>& badges() const noexcept { return badges_; }
    void awardBadge(std::string badge);

    // --- operators ---
    /// Adds a solve record (sugar over recordSolve) for expressive call sites.
    Team& operator+=(const SolveRecord& record);

    /// Ordering by team name (stable identity ordering; the *ranking* order is a
    /// separate score-based comparator in Scoreboard). Strict weak ordering.
    bool operator<(const Team& other) const noexcept { return name_ < other.name_; }

    /// Debug printing; friend so it can read private members.
    friend std::ostream& operator<<(std::ostream& os, const Team& team);

private:
    TeamId id_;
    std::string name_;
    UserId captainId_;
    std::string inviteCode_;
    std::vector<UserId> memberIds_;
    std::vector<SolveRecord> solved_;
    std::vector<HintUnlock> hintUnlocks_;
    std::set<std::string> badges_;
};

}  // namespace ctf

#endif  // CTF_CORE_TEAM_HPP
