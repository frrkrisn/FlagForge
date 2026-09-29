#include "ctf/scoring/ScoringStrategies.hpp"

#include <algorithm>
#include <cmath>
#include <utility>

namespace ctf::scoring {

// --- StaticScoring ----------------------------------------------------------
int StaticScoring::pointsFor(const ScoringContext& ctx) const {
    return ctx.basePoints;
}

std::unique_ptr<IScoringStrategy> StaticScoring::clone() const {
    return std::make_unique<StaticScoring>(*this);
}

// --- DecayScoring -----------------------------------------------------------
// points(s) = max(min, ceil(((min - initial)/decay^2) * s^2 + initial))   (PLAYBOOK §6.1)
int DecayScoring::pointsFor(const ScoringContext& ctx) const {
    const int initial = ctx.basePoints;
    const int minPts = ctx.minPoints;
    const int decay = ctx.decay;
    const int solves = std::max(0, ctx.solveCount);

    if (decay <= 0 || minPts >= initial) {
        return initial;  // degenerate config → behaves like static scoring
    }
    const double coeff = static_cast<double>(minPts - initial) /
                         static_cast<double>(decay) / static_cast<double>(decay);
    const double value = coeff * static_cast<double>(solves) * static_cast<double>(solves) +
                         static_cast<double>(initial);
    const int rounded = static_cast<int>(std::ceil(value));
    return std::max(minPts, rounded);
}

std::unique_ptr<IScoringStrategy> DecayScoring::clone() const {
    return std::make_unique<DecayScoring>(*this);
}

// --- FirstBloodScoring (Decorator) ------------------------------------------
FirstBloodScoring::FirstBloodScoring(std::unique_ptr<IScoringStrategy> inner)
    : inner_(std::move(inner)) {}

int FirstBloodScoring::pointsFor(const ScoringContext& ctx) const {
    const int base = inner_->pointsFor(ctx);
    if (!ctx.isFirstBlood) {
        return base;
    }
    const int bonus = static_cast<int>(std::lround(kFirstBloodBonus * ctx.basePoints));
    return base + bonus;
}

std::unique_ptr<IScoringStrategy> FirstBloodScoring::clone() const {
    return std::make_unique<FirstBloodScoring>(inner_->clone());
}

}  // namespace ctf::scoring
