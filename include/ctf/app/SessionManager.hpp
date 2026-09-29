#ifndef CTF_APP_SESSIONMANAGER_HPP
#define CTF_APP_SESSIONMANAGER_HPP

/// \file SessionManager.hpp
/// \brief Maps opaque random session tokens to user ids, with expiry and revocation.
///        Thread-safe (its own mutex). Tokens are 128-bit random hex (docs/api.md §2).

#include <chrono>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>

#include "ctf/core/Clock.hpp"
#include "ctf/core/Types.hpp"

namespace ctf::app {

class SessionManager {
public:
    /// Sessions live this long from creation (default 12h).
    static constexpr std::chrono::hours kDefaultTtl{12};

    /// \p clock is borrowed (owned by CTFManager). Defaults to a shared system clock.
    explicit SessionManager(const IClock& clock);

    // Owns a mutex → non-copyable, non-movable.
    SessionManager(const SessionManager&) = delete;
    SessionManager& operator=(const SessionManager&) = delete;

    /// Create a session for \p userId; returns the new token.
    SessionToken create(const UserId& userId);

    /// Resolve a token to a user id if the session exists and has not expired.
    std::optional<UserId> lookup(const SessionToken& token) const;

    /// Revoke a single session (logout).
    void revoke(const SessionToken& token);

    /// Revoke every session for a user (e.g. account deletion).
    void revokeAllFor(const UserId& userId);

    std::size_t activeCount() const;

private:
    struct Session {
        UserId userId;
        TimePoint expiresAt;
    };

    const IClock& clock_;
    mutable std::mutex mutex_;
    std::unordered_map<SessionToken, Session> sessions_;
};

}  // namespace ctf::app

#endif  // CTF_APP_SESSIONMANAGER_HPP
