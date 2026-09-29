// Phase 0 placeholder test: proves the Catch2 wiring and the ctf_core link work.
// Real per-class tests replace/extend this from Phase 2 onward.

#include <catch2/catch_test_macros.hpp>

#include <string>

#include "ctf/Version.hpp"

TEST_CASE("ctf_core exposes a non-empty semantic version", "[smoke]") {
    const std::string v = ctf::version();
    REQUIRE_FALSE(v.empty());
    // Expect a dotted semver-ish string like "0.1.0".
    REQUIRE(v.find('.') != std::string::npos);
}
