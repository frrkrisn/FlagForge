#include "ctf/core/Challenge.hpp"

#include <algorithm>
#include <string>
#include <utility>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Crypto.hpp"

namespace ctf {

int Challenge::nextId_ = 1;

Challenge::Challenge(ChallengeId id, std::string title, Category category, Difficulty difficulty,
                     int basePoints, std::unique_ptr<scoring::IScoringStrategy> strategy)
    : id_(std::move(id)),
      title_(std::move(title)),
      category_(category),
      difficulty_(difficulty),
      basePoints_(basePoints),
      minPoints_(basePoints / 5),  // default floor: 20% of base
      scoring_(std::move(strategy)) {
    if (basePoints_ <= 0) {
        throw ValidationException("Challenge base points must be positive");
    }
    if (!scoring_) {
        throw ValidationException("Challenge requires a scoring strategy");
    }
}

void Challenge::setScoringParams(int minPoints, int decay) {
    if (minPoints < 0 || minPoints > basePoints_) {
        throw ValidationException("minPoints must be within [0, basePoints]");
    }
    if (decay <= 0) {
        throw ValidationException("decay must be positive");
    }
    minPoints_ = minPoints;
    decay_ = decay;
}

const Hint* Challenge::findHint(const HintId& hintId) const {
    auto it = std::find_if(hints_.begin(), hints_.end(),
                           [&](const Hint& h) { return h.id() == hintId; });
    return it == hints_.end() ? nullptr : &*it;
}

const Attachment* Challenge::findAttachment(const std::string& name) const {
    auto it = std::find_if(attachments_.begin(), attachments_.end(),
                           [&](const Attachment& a) { return a.name == name; });
    return it == attachments_.end() ? nullptr : &*it;
}

int Challenge::currentPoints(int solveCount, bool firstBlood) const {
    const scoring::ScoringContext ctx{basePoints_, minPoints_, decay_, solveCount, firstBlood};
    return scoring_ ? scoring_->pointsFor(ctx) : basePoints_;
}

ChallengeId Challenge::nextAutoId() {
    return "c_" + std::to_string(nextId_++);
}

// --- StaticChallenge --------------------------------------------------------
StaticChallenge::StaticChallenge(ChallengeId id, std::string title, Category category,
                                 Difficulty difficulty, int basePoints,
                                 std::unique_ptr<scoring::IScoringStrategy> strategy,
                                 std::string flagHash)
    : Challenge(std::move(id), std::move(title), category, difficulty, basePoints,
                std::move(strategy)),
      flagHash_(std::move(flagHash)) {}

bool StaticChallenge::checkFlag(const FlagCheckContext&, const std::string& input) const {
    return crypto::constantTimeEquals(crypto::sha256Hex(input), flagHash_);
}

// --- DynamicFlagChallenge ---------------------------------------------------
DynamicFlagChallenge::DynamicFlagChallenge(ChallengeId id, std::string title, Category category,
                                           Difficulty difficulty, int basePoints,
                                           std::unique_ptr<scoring::IScoringStrategy> strategy,
                                           std::string flagPrefix)
    : Challenge(std::move(id), std::move(title), category, difficulty, basePoints,
                std::move(strategy)),
      flagPrefix_(std::move(flagPrefix)) {}

std::string DynamicFlagChallenge::expectedFlagFor(const TeamId& teamId,
                                                  const std::string& serverSecret) const {
    const std::string mac = crypto::hmacSha256Hex(serverSecret, id_ + ":" + teamId);
    return flagPrefix_ + "{" + mac.substr(0, 24) + "}";
}

bool DynamicFlagChallenge::checkFlag(const FlagCheckContext& ctx, const std::string& input) const {
    return crypto::constantTimeEquals(input, expectedFlagFor(ctx.teamId, ctx.serverSecret));
}

// --- MultiFlagChallenge -----------------------------------------------------
MultiFlagChallenge::MultiFlagChallenge(ChallengeId id, std::string title, Category category,
                                       Difficulty difficulty, int basePoints,
                                       std::unique_ptr<scoring::IScoringStrategy> strategy,
                                       std::vector<std::string> flagHashes)
    : Challenge(std::move(id), std::move(title), category, difficulty, basePoints,
                std::move(strategy)),
      flagHashes_(std::move(flagHashes)) {}

bool MultiFlagChallenge::checkFlag(const FlagCheckContext&, const std::string& input) const {
    const std::string inputHash = crypto::sha256Hex(input);
    return std::any_of(flagHashes_.begin(), flagHashes_.end(),
                       [&](const std::string& h) { return crypto::constantTimeEquals(inputHash, h); });
}

}  // namespace ctf
