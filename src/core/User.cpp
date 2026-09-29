#include "ctf/core/User.hpp"

#include <utility>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Crypto.hpp"

namespace ctf {

namespace {
constexpr std::size_t kMaxBio = 280;
constexpr std::size_t kMaxAvatarSeed = 64;
constexpr std::size_t kMaxThemePrefs = 2048;
}  // namespace

User::User(UserId id, std::string username, std::string email)
    : id_(std::move(id)),
      username_(std::move(username)),
      email_(std::move(email)),
      avatarSeed_(username_) {}

void User::setBio(std::string bio) {
    if (bio.size() > kMaxBio) {
        throw ValidationException("Bio too long (max 280 characters)");
    }
    bio_ = std::move(bio);
}

void User::setAvatarSeed(std::string seed) {
    if (seed.empty() || seed.size() > kMaxAvatarSeed) {
        throw ValidationException("Avatar seed must be 1–64 characters");
    }
    avatarSeed_ = std::move(seed);
}

void User::setThemePrefs(std::string prefsJson) {
    if (prefsJson.size() > kMaxThemePrefs) {
        throw ValidationException("Theme preferences too large (max 2 KB)");
    }
    // Structural JSON validation happens at the API boundary; the domain stores the
    // opaque string verbatim and never renders it (docs/api.md §5.1).
    themePrefs_ = std::move(prefsJson);
}

void User::setPassword(const std::string& plaintext) {
    if (plaintext.size() < 8) {
        throw ValidationException("Password must be at least 8 characters");
    }
    salt_ = crypto::randomSalt();
    passwordHash_ = crypto::hashPassword(plaintext, salt_);
}

bool User::verifyPassword(const std::string& plaintext) const {
    if (salt_.empty() || passwordHash_.empty()) {
        return false;
    }
    return crypto::constantTimeEquals(crypto::hashPassword(plaintext, salt_), passwordHash_);
}

void User::restoreCredential(std::string salt, std::string passwordHash) {
    salt_ = std::move(salt);
    passwordHash_ = std::move(passwordHash);
}

}  // namespace ctf
