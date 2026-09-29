#ifndef CTF_SCORING_SCORINGSTRATEGIES_HPP
#define CTF_SCORING_SCORINGSTRATEGIES_HPP

/// \file ScoringStrategies.hpp
/// \brief Concrete scoring strategies. StaticScoring and DecayScoring implement the
///        Strategy interface; FirstBloodScoring is a Decorator wrapping another
///        strategy and adding the first-blood bonus.

#include <memory>

#include "ctf/scoring/IScoringStrategy.hpp"

namespace ctf::scoring {

/// Constant value: always the challenge's base points (no decay).
class StaticScoring final : public IScoringStrategy {
public:
    int pointsFor(const ScoringContext& ctx) const override;
    std::unique_ptr<IScoringStrategy> clone() const override;
};

/// CTFd-style parabolic decay (PLAYBOOK §6.1):
///   points(s) = max(min, ceil(((min - initial)/decay^2) * s^2 + initial))
/// Monotonically non-increasing in solveCount and never below minPoints.
class DecayScoring final : public IScoringStrategy {
public:
    int pointsFor(const ScoringContext& ctx) const override;
    std::unique_ptr<IScoringStrategy> clone() const override;
};

/// Decorator: delegates to an inner strategy, then adds +10% of the base points for
/// the first solver only. Demonstrates Decorator over Strategy.
class FirstBloodScoring final : public IScoringStrategy {
public:
    explicit FirstBloodScoring(std::unique_ptr<IScoringStrategy> inner);

    int pointsFor(const ScoringContext& ctx) const override;
    std::unique_ptr<IScoringStrategy> clone() const override;

    /// Bonus fraction of base points awarded to the first blood (0.10 = +10%).
    static constexpr double kFirstBloodBonus = 0.10;

private:
    std::unique_ptr<IScoringStrategy> inner_;
};

}  // namespace ctf::scoring

#endif  // CTF_SCORING_SCORINGSTRATEGIES_HPP
