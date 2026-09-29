#ifndef CTF_CORE_SUBMISSION_HPP
#define CTF_CORE_SUBMISSION_HPP

/// \file Submission.hpp
/// \brief An immutable record of one flag submission. Demonstrates a static instance
///        counter (totalCount_) and operator== (value equality).

#include <cstddef>
#include <string>

#include "ctf/core/Types.hpp"

namespace ctf {

class Submission {
public:
    Submission(TeamId teamId, UserId playerId, ChallengeId challengeId, TimePoint timestamp,
               SubmitResult result);

    const TeamId& teamId() const noexcept { return teamId_; }
    const UserId& playerId() const noexcept { return playerId_; }
    const ChallengeId& challengeId() const noexcept { return challengeId_; }
    TimePoint timestamp() const noexcept { return timestamp_; }
    SubmitResult result() const noexcept { return result_; }

    /// Total submissions constructed this run (static member → shared across instances).
    static std::size_t totalCount() noexcept { return totalCount_; }

    /// Value equality across all fields.
    bool operator==(const Submission& other) const noexcept;
    bool operator!=(const Submission& other) const noexcept { return !(*this == other); }

private:
    TeamId teamId_;
    UserId playerId_;
    ChallengeId challengeId_;
    TimePoint timestamp_;
    SubmitResult result_;
    static std::size_t totalCount_;  ///< defined in src/core/Submission.cpp
};

}  // namespace ctf

#endif  // CTF_CORE_SUBMISSION_HPP
