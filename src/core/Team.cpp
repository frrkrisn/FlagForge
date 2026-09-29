#include "ctf/core/Team.hpp"

#include <algorithm>
#include <ostream>
#include <utility>

#include "ctf/Exceptions.hpp"

namespace ctf {

Team::Team(TeamId id, std::string name, UserId captainId, std::string inviteCode)
    : id_(std::move(id)),
      name_(std::move(name)),
      captainId_(std::move(captainId)),
      inviteCode_(std::move(inviteCode)) {
    memberIds_.push_back(captainId_);  // the captain is the first member
}

bool Team::hasMember(const UserId& userId) const noexcept {
    return std::find(memberIds_.begin(), memberIds_.end(), userId) != memberIds_.end();
}

void Team::addMember(const UserId& userId) {
    if (hasMember(userId)) {
        return;  // idempotent
    }
    if (isFull()) {
        throw TeamFullException("Team '" + name_ + "' is full (max " +
                                std::to_string(kMaxSize) + ")");
    }
    memberIds_.push_back(userId);
}

void Team::removeMember(const UserId& userId) {
    auto it = std::find(memberIds_.begin(), memberIds_.end(), userId);
    if (it == memberIds_.end()) {
        throw NotFoundException("User is not a member of this team");
    }
    memberIds_.erase(it);
    if (captainId_ == userId && !memberIds_.empty()) {
        captainId_ = memberIds_.front();  // captaincy transfers to the next member
    }
}

void Team::setCaptain(const UserId& userId) {
    if (!hasMember(userId)) {
        throw ValidationException("New captain must be a team member");
    }
    captainId_ = userId;
}

void Team::regenerateInviteCode(std::string newCode) {
    inviteCode_ = std::move(newCode);
}

bool Team::hasSolved(const ChallengeId& challengeId) const noexcept {
    return std::any_of(solved_.begin(), solved_.end(),
                       [&](const SolveRecord& r) { return r.challengeId == challengeId; });
}

bool Team::hasUnlockedHint(const ChallengeId& challengeId, const HintId& hintId) const noexcept {
    return std::any_of(hintUnlocks_.begin(), hintUnlocks_.end(), [&](const HintUnlock& u) {
        return u.challengeId == challengeId && u.hintId == hintId;
    });
}

void Team::recordSolve(const SolveRecord& record) {
    if (hasSolved(record.challengeId)) {
        throw DuplicateSolveException("Team already solved this challenge");
    }
    solved_.push_back(record);
}

void Team::recordHintUnlock(const HintUnlock& unlock) {
    if (hasUnlockedHint(unlock.challengeId, unlock.hintId)) {
        return;  // idempotent: charge once
    }
    hintUnlocks_.push_back(unlock);
}

void Team::awardBadge(std::string badge) {
    badges_.insert(std::move(badge));
}

Team& Team::operator+=(const SolveRecord& record) {
    recordSolve(record);
    return *this;
}

std::ostream& operator<<(std::ostream& os, const Team& team) {
    os << "Team{" << team.name_ << ", members=" << team.memberIds_.size()
       << ", solves=" << team.solved_.size() << "}";
    return os;
}

}  // namespace ctf
