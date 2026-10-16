#ifndef CTF_CORE_CHALLENGEFACTORY_HPP
#define CTF_CORE_CHALLENGEFACTORY_HPP

/// \file ChallengeFactory.hpp
/// \brief Factory pattern: turns a declarative ChallengeSpec into the right concrete
///        Challenge subclass (owning the right scoring Strategy), hashing any
///        plaintext flag so it is never stored in the clear.

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "ctf/core/Challenge.hpp"
#include "ctf/core/Types.hpp"

namespace ctf {

/// How a challenge's flag works.
enum class FlagType { Static, Dynamic, Multi };

/// Which scoring strategy to attach (mirrors docs/api.md ScoringStrategy).
enum class ScoringKind { Static, Decay, DecayFirstBlood, DynamicScore, DynamicFirstBlood };

/// A hint to attach (plaintext text + cost).
struct HintSpec {
    std::string text;
    int cost = 0;
};

/// Declarative description of a challenge to build (mirrors docs/api.md ChallengeSpec).
/// Plaintext flag(s) live here transiently and are hashed by the factory.
struct ChallengeSpec {
    ChallengeId id;  ///< empty → factory assigns Challenge::nextAutoId()
    std::string title;
    Category category = Category::Misc;
    Difficulty difficulty = Difficulty::Easy;
    std::string description;
    /// Explanation shown after a team solves it. Unset = leave an existing writeup untouched
    /// (so editing a challenge without sending one never wipes it); set to "" to clear it.
    std::optional<std::string> writeup;
    int basePoints = 100;
    int minPoints = 20;
    int decay = 10;
    ScoringKind scoring = ScoringKind::Decay;
    FlagType flagType = FlagType::Static;

    std::string flag;                 ///< Static: plaintext, hashed then discarded
    std::string flagPrefix = "CTF";   ///< Dynamic
    std::vector<std::string> flags;   ///< Multi: plaintext list, hashed then discarded

    std::vector<ChallengeId> prerequisites;
    std::vector<HintSpec> hints;
    std::vector<Attachment> attachments;
    bool visible = true;
};

/// Stateless factory. All members static — it holds nothing.
class ChallengeFactory {
public:
    ChallengeFactory() = delete;

    /// Build the concrete challenge described by \p spec. Throws ValidationException
    /// on inconsistent specs (e.g. dynamic flag with no prefix, base < min).
    static std::unique_ptr<Challenge> create(const ChallengeSpec& spec);

    /// Build just the scoring strategy for a ScoringKind (used by create + tests).
    static std::unique_ptr<scoring::IScoringStrategy> makeStrategy(ScoringKind kind);

    static ScoringKind scoringKindFromString(const std::string& s);
    static const char* toString(ScoringKind kind) noexcept;
    static FlagType flagTypeFromString(const std::string& s);
};

}  // namespace ctf

#endif  // CTF_CORE_CHALLENGEFACTORY_HPP
