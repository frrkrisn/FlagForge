#ifndef CTF_SCORING_ISCORINGSTRATEGY_HPP
#define CTF_SCORING_ISCORINGSTRATEGY_HPP

/// \file IScoringStrategy.hpp
/// \brief The Strategy-pattern interface for computing a challenge's point value,
///        plus the plain-data ScoringContext it operates on.
///
/// ScoringContext carries only primitives, so this header has no dependency on
/// ctf::core — keeping the core → scoring composition acyclic.

#include <memory>

namespace ctf::scoring {

/// Everything a scoring strategy needs to price one solve of one challenge.
struct ScoringContext {
    int basePoints = 0;   ///< the challenge's initial value
    int minPoints = 0;    ///< floor the value decays to
    int decay = 10;       ///< solves at which the value reaches minPoints
    int solveCount = 0;   ///< how many teams have already solved it
    bool isFirstBlood = false;  ///< is this the first solve?
};

/// Strategy interface: given a context, return the points to award. Pure virtual
/// → concrete strategies (Static, Decay, FirstBlood decorator) provide behavior.
class IScoringStrategy {
public:
    virtual ~IScoringStrategy() = default;

    /// Points to award for a solve described by \p ctx (never below ctx.minPoints).
    virtual int pointsFor(const ScoringContext& ctx) const = 0;

    /// Polymorphic copy — challenges own their strategy by value semantics.
    virtual std::unique_ptr<IScoringStrategy> clone() const = 0;
};

}  // namespace ctf::scoring

#endif  // CTF_SCORING_ISCORINGSTRATEGY_HPP
