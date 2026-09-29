#ifndef CTF_CORE_TYPES_HPP
#define CTF_CORE_TYPES_HPP

/// \file Types.hpp
/// \brief Shared id aliases, the clock/time-point type, and the core domain enums
///        (Role, Category, Difficulty, SubmitResult, Severity) with string conversions.
///
/// Pure declarations + enums. Conversions are defined in src/core/Types.cpp. No I/O.

#include <chrono>
#include <string>

namespace ctf {

// --- Identifier aliases (opaque strings in the API, see docs/api.md §4) -----
using UserId = std::string;
using TeamId = std::string;
using ChallengeId = std::string;
using HintId = std::string;
using AnnouncementId = std::string;
using AlertId = std::string;
using SessionToken = std::string;

// --- Time --------------------------------------------------------------------
using Clock = std::chrono::system_clock;
using TimePoint = std::chrono::time_point<Clock>;

/// Format a time point as ISO-8601 UTC, e.g. "2026-09-29T14:03:00Z".
std::string toIso8601(TimePoint tp);

/// Parse an ISO-8601 UTC string. Throws ValidationException on malformed input.
TimePoint fromIso8601(const std::string& iso);

// --- Enums -------------------------------------------------------------------
enum class Role { Player, Admin };

enum class Category { Web, Crypto, Forensics, Reverse, Pwn, Misc };

enum class Difficulty { Easy, Medium, Hard };

/// Outcome of a flag submission (docs/api.md SubmitResult).
enum class SubmitResult {
    Correct,
    Wrong,
    AlreadySolved,
    Locked,
    Cooldown,
    Closed,
    FlagSharing,
};

enum class Severity { Info, Warning, Critical };

/// Event lifecycle state machine: NotStarted → Running ⇄ Paused → Ended.
enum class EventState { NotStarted, Running, Paused, Ended };

// --- Enum <-> string (UPPER_SNAKE wire form) ---------------------------------
const char* toString(Role r) noexcept;
const char* toString(Category c) noexcept;
const char* toString(Difficulty d) noexcept;
const char* toString(SubmitResult s) noexcept;
const char* toString(Severity s) noexcept;
const char* toString(EventState s) noexcept;

Role roleFromString(const std::string& s);
Category categoryFromString(const std::string& s);
Difficulty difficultyFromString(const std::string& s);
Severity severityFromString(const std::string& s);
SubmitResult submitResultFromString(const std::string& s);

}  // namespace ctf

#endif  // CTF_CORE_TYPES_HPP
