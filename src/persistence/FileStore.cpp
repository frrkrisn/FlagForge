#include "ctf/persistence/FileStore.hpp"

#include <filesystem>
#include <fstream>
#include <iterator>
#include <utility>

#include "ctf/Exceptions.hpp"

namespace ctf::persistence {

namespace fs = std::filesystem;

FileStore::FileStore(std::string rootDir) : root_(std::move(rootDir)) {}

bool FileStore::isSafeName(const std::string& name) noexcept {
    if (name.empty() || name.size() > 80 || name.front() == '.') {
        return false;
    }
    for (const char c : name) {
        const bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-';
        if (!ok) {
            return false;
        }
    }
    return true;
}

std::string FileStore::pathFor(const std::string& scope, const std::string& name) const {
    if (!isSafeName(scope) || !isSafeName(name)) {
        throw ValidationException("Invalid file name (use letters, digits, '.', '_' and '-')");
    }
    return (fs::path(root_) / scope / name).string();
}

void FileStore::save(const std::string& scope, const std::string& name, const std::string& bytes) {
    if (bytes.size() > kMaxBytes) {
        throw ValidationException("File too large (max 25 MB)");
    }
    const fs::path target(pathFor(scope, name));
    fs::create_directories(target.parent_path());

    const fs::path tmp = target.string() + ".tmp";
    {
        std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
        if (!out) {
            throw std::runtime_error("FileStore: cannot open temp file for " + name);
        }
        out.write(bytes.data(), static_cast<std::streamsize>(bytes.size()));
        out.flush();
        if (!out) {
            throw std::runtime_error("FileStore: write failed for " + name);
        }
    }
    fs::rename(tmp, target);  // atomic replace
}

std::string FileStore::load(const std::string& scope, const std::string& name) const {
    const std::string path = pathFor(scope, name);
    std::ifstream in(path, std::ios::binary);
    if (!in) {
        throw NotFoundException("No such file: " + name);
    }
    return std::string(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
}

bool FileStore::exists(const std::string& scope, const std::string& name) const {
    if (!isSafeName(scope) || !isSafeName(name)) {
        return false;
    }
    return fs::exists(fs::path(root_) / scope / name);
}

void FileStore::remove(const std::string& scope, const std::string& name) {
    std::error_code ec;
    fs::remove(pathFor(scope, name), ec);  // absent file is fine
}

void FileStore::removeScope(const std::string& scope) {
    if (!isSafeName(scope)) {
        return;
    }
    std::error_code ec;
    fs::remove_all(fs::path(root_) / scope, ec);
}

}  // namespace ctf::persistence
