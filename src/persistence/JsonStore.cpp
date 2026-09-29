#include "ctf/persistence/JsonStore.hpp"

#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <utility>

namespace ctf::persistence {

namespace fs = std::filesystem;

JsonStore::JsonStore(std::string path) : path_(std::move(path)) {}

JsonStore::~JsonStore() = default;

// Rule of Five: transfer the owned path + buffer; leave the source empty.
JsonStore::JsonStore(JsonStore&& other) noexcept
    : path_(std::move(other.path_)), buffer_(std::move(other.buffer_)) {}

JsonStore& JsonStore::operator=(JsonStore&& other) noexcept {
    if (this != &other) {
        path_ = std::move(other.path_);
        buffer_ = std::move(other.buffer_);
    }
    return *this;
}

void JsonStore::save(const nlohmann::json& document) {
    const fs::path target(path_);
    if (target.has_parent_path()) {
        fs::create_directories(target.parent_path());
    }

    // Serialize into the reusable buffer, write to a temp file, then atomically rename.
    buffer_ = document.dump(2);
    const fs::path tmp = target.string() + ".tmp";
    {
        std::ofstream out(tmp, std::ios::binary | std::ios::trunc);
        if (!out) {
            throw std::runtime_error("JsonStore: cannot open temp file for " + path_);
        }
        out.write(buffer_.data(), static_cast<std::streamsize>(buffer_.size()));
        out.flush();
        if (!out) {
            throw std::runtime_error("JsonStore: write failed for " + path_);
        }
    }
    fs::rename(tmp, target);  // atomic replace on both POSIX and Windows
}

nlohmann::json JsonStore::load() const {
    if (!exists()) {
        return nlohmann::json::object();
    }
    std::ifstream in(path_, std::ios::binary);
    if (!in) {
        throw std::runtime_error("JsonStore: cannot open " + path_);
    }
    try {
        nlohmann::json doc;
        in >> doc;
        return doc;
    } catch (const nlohmann::json::parse_error& e) {
        throw std::runtime_error("JsonStore: corrupt JSON in " + path_ + ": " + e.what());
    }
}

bool JsonStore::exists() const {
    return fs::exists(path_);
}

}  // namespace ctf::persistence
