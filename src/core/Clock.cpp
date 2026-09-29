#include "ctf/core/Clock.hpp"

namespace ctf {

TimePoint SystemClock::now() const {
    return Clock::now();
}

}  // namespace ctf
