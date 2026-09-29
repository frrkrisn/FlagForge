#include "ctf/app/SessionManager.hpp"

#include "ctf/core/Crypto.hpp"

namespace ctf::app {

SessionManager::SessionManager(const IClock& clock) : clock_(clock) {}

SessionToken SessionManager::create(const UserId& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    SessionToken token = crypto::randomToken(16);  // 128-bit
    sessions_[token] = Session{userId, clock_.now() + kDefaultTtl};
    return token;
}

std::optional<UserId> SessionManager::lookup(const SessionToken& token) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = sessions_.find(token);
    if (it == sessions_.end()) {
        return std::nullopt;
    }
    if (it->second.expiresAt <= clock_.now()) {
        return std::nullopt;  // expired (pruned lazily on next create/revoke sweep)
    }
    return it->second.userId;
}

void SessionManager::revoke(const SessionToken& token) {
    std::lock_guard<std::mutex> lock(mutex_);
    sessions_.erase(token);
}

void SessionManager::revokeAllFor(const UserId& userId) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (auto it = sessions_.begin(); it != sessions_.end();) {
        it = (it->second.userId == userId) ? sessions_.erase(it) : std::next(it);
    }
}

std::size_t SessionManager::activeCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    const TimePoint now = clock_.now();
    std::size_t count = 0;
    for (const auto& [token, session] : sessions_) {
        if (session.expiresAt > now) {
            ++count;
        }
    }
    return count;
}

}  // namespace ctf::app
