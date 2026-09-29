#ifndef CTF_EXCEPTIONS_HPP
#define CTF_EXCEPTIONS_HPP

/// \file Exceptions.hpp
/// \brief The custom exception hierarchy. Core code throws these; the server layer
///        (ApiRouter) maps each to an HTTP status + stable error code (docs/api.md §3).
///
/// Design: every domain error is a typed exception deriving from CtfException, which
/// derives from std::exception. We never return magic error codes (CLAUDE.md rule #8).
/// Each exception knows its own machine-readable code() and httpStatus() so the mapping
/// lives in one obvious place.

#include <stdexcept>
#include <string>
#include <utility>

namespace ctf {

/// Base class for every FlagForge domain exception.
class CtfException : public std::exception {
public:
    explicit CtfException(std::string message) : message_(std::move(message)) {}
    ~CtfException() override = default;

    /// Human-readable, safe-to-display message (never contains a flag or stack trace).
    const char* what() const noexcept override { return message_.c_str(); }

    /// Stable machine-readable code, e.g. "TEAM_FULL" (docs/api.md §3).
    virtual const char* code() const noexcept = 0;

    /// HTTP status the server maps this to.
    virtual int httpStatus() const noexcept = 0;

protected:
    std::string message_;
};

/// 400 — invalid user input (length, format, whitelist).
class ValidationException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "VALIDATION"; }
    int httpStatus() const noexcept override { return 400; }
};

/// 401 — missing or invalid credentials / session.
class AuthException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "UNAUTHENTICATED"; }
    int httpStatus() const noexcept override { return 401; }
};

/// 403 — authenticated but not allowed (wrong role, not captain, not a member).
class PermissionException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "FORBIDDEN"; }
    int httpStatus() const noexcept override { return 403; }
};

/// 404 — entity does not exist.
class NotFoundException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "NOT_FOUND"; }
    int httpStatus() const noexcept override { return 404; }
};

/// 409 — the team already solved this challenge.
class DuplicateSolveException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "CONFLICT"; }
    int httpStatus() const noexcept override { return 409; }
};

/// 409 — the team is at capacity (Team::kMaxSize).
class TeamFullException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "TEAM_FULL"; }
    int httpStatus() const noexcept override { return 409; }
};

/// 423 — a prerequisite challenge has not been solved by the team yet.
class ChallengeLockedException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "LOCKED"; }
    int httpStatus() const noexcept override { return 423; }
};

/// 429 — too many wrong attempts; the team is on cooldown for this challenge.
class CooldownException final : public CtfException {
public:
    explicit CooldownException(std::string message, int retryAfterSeconds)
        : CtfException(std::move(message)), retryAfterSeconds_(retryAfterSeconds) {}
    const char* code() const noexcept override { return "COOLDOWN"; }
    int httpStatus() const noexcept override { return 429; }
    int retryAfterSeconds() const noexcept { return retryAfterSeconds_; }

private:
    int retryAfterSeconds_;
};

/// 403 — the competition is not currently running.
class CompetitionClosedException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "CLOSED"; }
    int httpStatus() const noexcept override { return 403; }
};

/// 400 — a flag does not match the required CTF{...} format.
class InvalidFlagFormatException final : public CtfException {
public:
    using CtfException::CtfException;
    const char* code() const noexcept override { return "VALIDATION"; }
    int httpStatus() const noexcept override { return 400; }
};

}  // namespace ctf

#endif  // CTF_EXCEPTIONS_HPP
