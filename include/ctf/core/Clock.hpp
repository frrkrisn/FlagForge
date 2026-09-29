#ifndef CTF_CORE_CLOCK_HPP
#define CTF_CORE_CLOCK_HPP

/// \file Clock.hpp
/// \brief An injectable clock interface so time-dependent logic (cooldowns, freeze,
///        rate limits) can be unit-tested deterministically without sleeping.

#include "ctf/core/Types.hpp"

namespace ctf {

/// Abstraction over "what time is it now". Production uses SystemClock; tests use a
/// FakeClock they advance by hand.
class IClock {
public:
    virtual ~IClock() = default;
    virtual TimePoint now() const = 0;
};

/// The real wall clock.
class SystemClock final : public IClock {
public:
    TimePoint now() const override;
};

}  // namespace ctf

#endif  // CTF_CORE_CLOCK_HPP
