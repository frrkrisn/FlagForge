#ifndef CTF_PERSISTENCE_JSONSTORE_HPP
#define CTF_PERSISTENCE_JSONSTORE_HPP

/// \file JsonStore.hpp
/// \brief Atomic JSON file persistence: writes to a temp file then renames, so a crash
///        mid-write never corrupts the data file. Owns a path + reusable buffer, so it
///        follows the Rule of Five explicitly (documented = default / = delete choices).
///
/// This is the persistence boundary; it *does* touch the filesystem (allowed here, not
/// in core/scoring/events).

#include <string>

#include <nlohmann/json.hpp>

namespace ctf::persistence {

class JsonStore {
public:
    /// Bind to a file path (not yet read/written).
    explicit JsonStore(std::string path);
    ~JsonStore();

    // Rule of Five — owns a path + buffer. Copying a store would alias the same file,
    // so copying is deleted; moving transfers ownership.
    JsonStore(const JsonStore&) = delete;
    JsonStore& operator=(const JsonStore&) = delete;
    JsonStore(JsonStore&&) noexcept;
    JsonStore& operator=(JsonStore&&) noexcept;

    /// Atomically write \p document (temp file + rename). Throws on I/O failure.
    void save(const nlohmann::json& document);

    /// Load and parse the document. Returns an empty object if the file is absent.
    nlohmann::json load() const;

    bool exists() const;
    const std::string& path() const noexcept { return path_; }

    /// Schema version written into every document under "schemaVersion".
    static constexpr int kSchemaVersion = 1;

private:
    std::string path_;
    std::string buffer_;  ///< reused serialization buffer (owned resource)
};

}  // namespace ctf::persistence

#endif  // CTF_PERSISTENCE_JSONSTORE_HPP
