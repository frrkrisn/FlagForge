#ifndef CTF_VERSION_HPP
#define CTF_VERSION_HPP

/// \file Version.hpp
/// \brief Compile-time and run-time version information for the ctf_core library.

namespace ctf {

/// Semantic version string of the ctf_core library, e.g. "0.1.0".
/// Defined in src/core/Version.cpp so the static library always has at least
/// one translation unit.
const char* version() noexcept;

}  // namespace ctf

#endif  // CTF_VERSION_HPP
