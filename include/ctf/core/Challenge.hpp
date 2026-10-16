#ifndef CTF_CORE_CHALLENGE_HPP
#define CTF_CORE_CHALLENGE_HPP

/// \file Challenge.hpp
/// \brief Abstract Challenge and its concrete subclasses. The heart of the OOP
///        showcase: abstraction (pure virtual checkFlag), inheritance, runtime
///        polymorphism, composition (owns Hints + a scoring Strategy), a static
///        id counter, and RAII (unique_ptr strategy).

#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "ctf/core/Hint.hpp"
#include "ctf/core/Types.hpp"
#include "ctf/scoring/IScoringStrategy.hpp"

namespace ctf {

/// A downloadable file attached to a challenge (metadata only; bytes live on disk).
struct Attachment {
    std::string name;
    std::size_t size = 0;
    std::string sha256;                ///< hex digest of the stored bytes (shown to players)
    std::string transform = "none";    ///< how the bytes are personalised per team on download
};

/// Context passed to checkFlag: the submitting team and the server secret (needed
/// only by per-team dynamic flags). Keeps core free of global/singleton state.
struct FlagCheckContext {
    TeamId teamId;
    std::string serverSecret;
};

/// Abstract base for every challenge type.
class Challenge {
public:
    Challenge(ChallengeId id, std::string title, Category category, Difficulty difficulty,
              int basePoints, std::unique_ptr<scoring::IScoringStrategy> strategy);
    virtual ~Challenge() = default;

    Challenge(const Challenge&) = delete;
    Challenge& operator=(const Challenge&) = delete;

    /// Does \p input match the correct flag for this challenge in \p ctx?
    /// Pure virtual → Challenge is abstract; StaticChallenge, DynamicFlagChallenge
    /// and MultiFlagChallenge each implement it differently.
    virtual bool checkFlag(const FlagCheckContext& ctx, const std::string& input) const = 0;

    /// Machine label for the concrete type (e.g. "STATIC", "DYNAMIC") — used by the
    /// factory / serializer.
    virtual const char* typeTag() const noexcept = 0;

    // --- identity / metadata ---
    const ChallengeId& id() const noexcept { return id_; }
    const std::string& title() const noexcept { return title_; }
    Category category() const noexcept { return category_; }
    Difficulty difficulty() const noexcept { return difficulty_; }
    int basePoints() const noexcept { return basePoints_; }
    int minPoints() const noexcept { return minPoints_; }
    int decay() const noexcept { return decay_; }
    bool visible() const noexcept { return visible_; }
    const std::string& description() const noexcept { return description_; }
    const std::vector<ChallengeId>& prerequisites() const noexcept { return prerequisites_; }
    const std::vector<Hint>& hints() const noexcept { return hints_; }
    const std::vector<Attachment>& attachments() const noexcept { return attachments_; }

    // --- mutators (used by admin CRUD / factory) ---
    void setDescription(std::string md) { description_ = std::move(md); }

    /// The author's explanation (markdown). Revealed to a team only after it solves the challenge.
    const std::string& writeup() const noexcept { return writeup_; }
    void setWriteup(std::string md);  // validates length
    void setDifficulty(Difficulty d) noexcept { difficulty_ = d; }
    void setVisible(bool v) noexcept { visible_ = v; }
    void setScoringParams(int minPoints, int decay);
    /// Informational label for the scoring strategy (e.g. "DECAY_FIRSTBLOOD"), set by
    /// the factory and surfaced in the API; does not affect the owned strategy object.
    void setScoringTag(std::string tag) { scoringTag_ = std::move(tag); }
    const std::string& scoringTag() const noexcept { return scoringTag_; }
    void setPrerequisites(std::vector<ChallengeId> prereqs) { prerequisites_ = std::move(prereqs); }
    void addHint(Hint hint) { hints_.push_back(std::move(hint)); }
    void addAttachment(Attachment a) { attachments_.push_back(std::move(a)); }
    void setAttachments(std::vector<Attachment> list) { attachments_ = std::move(list); }
    const Attachment* findAttachment(const std::string& name) const;
    const Hint* findHint(const HintId& hintId) const;

    /// Current point value after \p solveCount solves, delegating to the strategy
    /// (runtime polymorphism). \p firstBlood adds the decorator bonus when set.
    int currentPoints(int solveCount, bool firstBlood) const;

    /// Next auto id "c_<n>" (static member → shared counter, demonstrates statics).
    static ChallengeId nextAutoId();

protected:
    ChallengeId id_;
    std::string title_;
    std::string description_;
    std::string writeup_;
    Category category_;
    Difficulty difficulty_;
    int basePoints_;
    int minPoints_;
    int decay_ = 10;
    std::string scoringTag_ = "DECAY";
    std::vector<ChallengeId> prerequisites_;
    std::vector<Hint> hints_;
    std::vector<Attachment> attachments_;
    bool visible_ = true;
    std::unique_ptr<scoring::IScoringStrategy> scoring_;

private:
    static int nextId_;  ///< defined in src/core/Challenge.cpp
};

/// One fixed flag, stored only as a SHA-256 hash.
class StaticChallenge final : public Challenge {
public:
    StaticChallenge(ChallengeId id, std::string title, Category category, Difficulty difficulty,
                    int basePoints, std::unique_ptr<scoring::IScoringStrategy> strategy,
                    std::string flagHash);

    bool checkFlag(const FlagCheckContext& ctx, const std::string& input) const override;
    const char* typeTag() const noexcept override { return "STATIC"; }

    /// The stored SHA-256 hash (never the plaintext). Server-side only — never placed
    /// in an API response.
    const std::string& flagHash() const noexcept { return flagHash_; }

private:
    std::string flagHash_;  // SHA-256 hex; never the plaintext
};

/// Per-team flag: CTF{ hex(HMAC(secret, id + ":" + teamId))[0..24] } (PLAYBOOK §6.4).
class DynamicFlagChallenge final : public Challenge {
public:
    DynamicFlagChallenge(ChallengeId id, std::string title, Category category,
                         Difficulty difficulty, int basePoints,
                         std::unique_ptr<scoring::IScoringStrategy> strategy,
                         std::string flagPrefix);

    bool checkFlag(const FlagCheckContext& ctx, const std::string& input) const override;
    const char* typeTag() const noexcept override { return "DYNAMIC"; }

    /// The correct flag for a given team — admin/demo only, never a player API.
    std::string expectedFlagFor(const TeamId& teamId, const std::string& serverSecret) const;

    const std::string& flagPrefix() const noexcept { return flagPrefix_; }

private:
    std::string flagPrefix_;
};

/// N flags with (stretch) partial credit; stores only hashes.
class MultiFlagChallenge final : public Challenge {
public:
    MultiFlagChallenge(ChallengeId id, std::string title, Category category,
                       Difficulty difficulty, int basePoints,
                       std::unique_ptr<scoring::IScoringStrategy> strategy,
                       std::vector<std::string> flagHashes);

    bool checkFlag(const FlagCheckContext& ctx, const std::string& input) const override;
    const char* typeTag() const noexcept override { return "MULTI"; }

    /// The stored SHA-256 hashes (never plaintext). Server-side only.
    const std::vector<std::string>& flagHashes() const noexcept { return flagHashes_; }

private:
    std::vector<std::string> flagHashes_;
};

}  // namespace ctf

#endif  // CTF_CORE_CHALLENGE_HPP
