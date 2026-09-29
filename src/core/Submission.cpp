#include "ctf/core/Submission.hpp"

#include <utility>

namespace ctf {

std::size_t Submission::totalCount_ = 0;

Submission::Submission(TeamId teamId, UserId playerId, ChallengeId challengeId,
                       TimePoint timestamp, SubmitResult result)
    : teamId_(std::move(teamId)),
      playerId_(std::move(playerId)),
      challengeId_(std::move(challengeId)),
      timestamp_(timestamp),
      result_(result) {
    ++totalCount_;
}

bool Submission::operator==(const Submission& other) const noexcept {
    return teamId_ == other.teamId_ && playerId_ == other.playerId_ &&
           challengeId_ == other.challengeId_ && timestamp_ == other.timestamp_ &&
           result_ == other.result_;
}

}  // namespace ctf
