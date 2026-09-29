#ifndef CTF_CORE_USER_HPP
#define CTF_CORE_USER_HPP

/// \file User.hpp
/// \brief Abstract User and its concrete subclasses Player and Admin.
///        Demonstrates: abstraction (pure virtual role()), inheritance,
///        encapsulation (password hash + salt are private).

#include <optional>
#include <string>

#include "ctf/core/Types.hpp"

namespace ctf {

/// Abstract base for all accounts. Owns identity + credentials; the credential
/// hash and salt are private and only touched through setPassword/verifyPassword.
class User {
public:
    User(UserId id, std::string username, std::string email);
    virtual ~User() = default;

    // Non-copyable, movable (users are held by unique_ptr in repositories).
    User(const User&) = delete;
    User& operator=(const User&) = delete;
    User(User&&) noexcept = default;
    User& operator=(User&&) noexcept = default;

    /// Which role this account has. Pure virtual → User is abstract.
    virtual Role role() const noexcept = 0;

    const UserId& id() const noexcept { return id_; }
    const std::string& username() const noexcept { return username_; }
    const std::string& email() const noexcept { return email_; }
    const std::string& bio() const noexcept { return bio_; }
    const std::string& avatarSeed() const noexcept { return avatarSeed_; }
    const std::string& themePrefs() const noexcept { return themePrefs_; }

    void setBio(std::string bio);                 // validates length
    void setAvatarSeed(std::string seed);         // validates length
    void setThemePrefs(std::string prefsJson);    // validates size (<= 2 KB) + JSON

    /// Set the password: generates a fresh salt and stores only the hash.
    void setPassword(const std::string& plaintext);

    /// Constant-time verification against the stored salted hash.
    bool verifyPassword(const std::string& plaintext) const;

    // For persistence: restore an already-hashed credential (no re-hashing).
    void restoreCredential(std::string salt, std::string passwordHash);
    const std::string& salt() const noexcept { return salt_; }
    const std::string& passwordHash() const noexcept { return passwordHash_; }

protected:
    UserId id_;
    std::string username_;
    std::string email_;
    std::string bio_;
    std::string avatarSeed_;
    std::string themePrefs_;

private:
    std::string salt_;
    std::string passwordHash_;
};

/// A competing user. Belongs to at most one team.
class Player final : public User {
public:
    using User::User;
    Role role() const noexcept override { return Role::Player; }

    const std::optional<TeamId>& teamId() const noexcept { return teamId_; }
    void joinTeam(TeamId id) { teamId_ = std::move(id); }
    void leaveTeam() noexcept { teamId_.reset(); }
    bool hasTeam() const noexcept { return teamId_.has_value(); }

    int personalSolves() const noexcept { return personalSolves_; }
    void incrementSolves() noexcept { ++personalSolves_; }

private:
    std::optional<TeamId> teamId_;
    int personalSolves_ = 0;
};

/// An organiser. Does not compete; manages challenges, the event and alerts.
class Admin final : public User {
public:
    using User::User;
    Role role() const noexcept override { return Role::Admin; }
};

}  // namespace ctf

#endif  // CTF_CORE_USER_HPP
