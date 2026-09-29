#include "ctf/core/ChallengeFactory.hpp"

#include <string>
#include <utility>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Crypto.hpp"
#include "ctf/scoring/ScoringStrategies.hpp"

namespace ctf {

std::unique_ptr<scoring::IScoringStrategy> ChallengeFactory::makeStrategy(ScoringKind kind) {
    using namespace scoring;
    switch (kind) {
        case ScoringKind::Static:
            return std::make_unique<StaticScoring>();
        case ScoringKind::Decay:
        case ScoringKind::DynamicScore:  // dynamic-flag challenges still decay
            return std::make_unique<DecayScoring>();
        case ScoringKind::DecayFirstBlood:
        case ScoringKind::DynamicFirstBlood:
            return std::make_unique<FirstBloodScoring>(std::make_unique<DecayScoring>());
    }
    return std::make_unique<DecayScoring>();
}

const char* ChallengeFactory::toString(ScoringKind kind) noexcept {
    switch (kind) {
        case ScoringKind::Static: return "STATIC";
        case ScoringKind::Decay: return "DECAY";
        case ScoringKind::DecayFirstBlood: return "DECAY_FIRSTBLOOD";
        case ScoringKind::DynamicScore: return "DYNAMIC";
        case ScoringKind::DynamicFirstBlood: return "DYNAMIC_FIRSTBLOOD";
    }
    return "DECAY";
}

ScoringKind ChallengeFactory::scoringKindFromString(const std::string& s) {
    if (s == "STATIC") return ScoringKind::Static;
    if (s == "DECAY") return ScoringKind::Decay;
    if (s == "DECAY_FIRSTBLOOD") return ScoringKind::DecayFirstBlood;
    if (s == "DYNAMIC") return ScoringKind::DynamicScore;
    if (s == "DYNAMIC_FIRSTBLOOD") return ScoringKind::DynamicFirstBlood;
    throw ValidationException("Unknown scoring strategy: " + s);
}

FlagType ChallengeFactory::flagTypeFromString(const std::string& s) {
    if (s == "STATIC") return FlagType::Static;
    if (s == "DYNAMIC") return FlagType::Dynamic;
    if (s == "MULTI") return FlagType::Multi;
    throw ValidationException("Unknown flag type: " + s);
}

std::unique_ptr<Challenge> ChallengeFactory::create(const ChallengeSpec& spec) {
    ChallengeId id = spec.id.empty() ? Challenge::nextAutoId() : spec.id;
    auto strategy = makeStrategy(spec.scoring);

    std::unique_ptr<Challenge> challenge;
    switch (spec.flagType) {
        case FlagType::Static: {
            if (spec.flag.empty()) {
                throw ValidationException("Static challenge requires a flag");
            }
            challenge = std::make_unique<StaticChallenge>(
                std::move(id), spec.title, spec.category, spec.difficulty, spec.basePoints,
                std::move(strategy), crypto::sha256Hex(spec.flag));
            break;
        }
        case FlagType::Dynamic: {
            if (spec.flagPrefix.empty()) {
                throw ValidationException("Dynamic challenge requires a flag prefix");
            }
            challenge = std::make_unique<DynamicFlagChallenge>(
                std::move(id), spec.title, spec.category, spec.difficulty, spec.basePoints,
                std::move(strategy), spec.flagPrefix);
            break;
        }
        case FlagType::Multi: {
            if (spec.flags.empty()) {
                throw ValidationException("Multi-flag challenge requires at least one flag");
            }
            std::vector<std::string> hashes;
            hashes.reserve(spec.flags.size());
            for (const auto& f : spec.flags) {
                hashes.push_back(crypto::sha256Hex(f));
            }
            challenge = std::make_unique<MultiFlagChallenge>(
                std::move(id), spec.title, spec.category, spec.difficulty, spec.basePoints,
                std::move(strategy), std::move(hashes));
            break;
        }
    }

    challenge->setDescription(spec.description);
    challenge->setScoringParams(spec.minPoints, spec.decay);
    challenge->setVisible(spec.visible);
    challenge->setPrerequisites(spec.prerequisites);
    for (std::size_t i = 0; i < spec.hints.size(); ++i) {
        challenge->addHint(Hint("h_" + std::to_string(i + 1), spec.hints[i].text,
                                spec.hints[i].cost));
    }
    for (const auto& a : spec.attachments) {
        challenge->addAttachment(a);
    }
    return challenge;
}

}  // namespace ctf
