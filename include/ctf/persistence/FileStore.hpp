#ifndef CTF_PERSISTENCE_FILESTORE_HPP
#define CTF_PERSISTENCE_FILESTORE_HPP

/// \file FileStore.hpp
/// \brief Stores binary files (challenge attachments) under a root directory, grouped by
///        a "scope" (the challenge id). Binary-safe, atomic writes (temp file + rename),
///        and strict name validation so a name can never escape the root directory.
///
/// Like JsonStore this is part of the persistence boundary: it touches the filesystem,
/// which core/scoring/events never do.

#include <string>

namespace ctf::persistence {

class FileStore {
public:
    /// Largest file accepted by save() (25 MiB).
    static constexpr std::size_t kMaxBytes = 25u * 1024u * 1024u;

    explicit FileStore(std::string rootDir);

    /// A safe name is 1–80 chars of [A-Za-z0-9._-], not starting with '.'. This rules out
    /// path separators and traversal ("..", "a/b", absolute paths) by construction.
    static bool isSafeName(const std::string& name) noexcept;

    /// Write \p bytes atomically. Throws ValidationException for an unsafe name/scope or an
    /// oversized file. Replaces any existing file of that name.
    void save(const std::string& scope, const std::string& name, const std::string& bytes);

    /// Read a file back. Throws NotFoundException if it does not exist.
    std::string load(const std::string& scope, const std::string& name) const;

    bool exists(const std::string& scope, const std::string& name) const;

    /// Delete one file (no error if absent).
    void remove(const std::string& scope, const std::string& name);

    /// Delete every file of a scope (e.g. when a challenge is deleted).
    void removeScope(const std::string& scope);

    const std::string& root() const noexcept { return root_; }

private:
    std::string pathFor(const std::string& scope, const std::string& name) const;

    std::string root_;
};

}  // namespace ctf::persistence

#endif  // CTF_PERSISTENCE_FILESTORE_HPP
