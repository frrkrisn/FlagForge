#include "ctf/core/Crypto.hpp"

#include <array>
#include <random>

#include <picosha2.h>

namespace ctf::crypto {

namespace {
constexpr std::size_t kBlockSize = 64;   // SHA-256 block size (bytes)
constexpr std::size_t kDigestSize = 32;  // SHA-256 output size (bytes)

std::vector<unsigned char> sha256Raw(const std::vector<unsigned char>& data) {
    std::vector<unsigned char> digest(kDigestSize);
    picosha2::hash256(data.begin(), data.end(), digest.begin(), digest.end());
    return digest;
}
}  // namespace

std::string sha256Hex(const std::string& message) {
    return picosha2::hash256_hex_string(message);
}

std::string hmacSha256Hex(const std::string& key, const std::string& message) {
    std::vector<unsigned char> k(key.begin(), key.end());
    if (k.size() > kBlockSize) {
        k = sha256Raw(k);
    }
    k.resize(kBlockSize, 0x00);  // zero-pad to the block size

    std::vector<unsigned char> inner;
    inner.reserve(kBlockSize + message.size());
    std::vector<unsigned char> outer;
    outer.reserve(kBlockSize + kDigestSize);
    for (std::size_t i = 0; i < kBlockSize; ++i) {
        inner.push_back(static_cast<unsigned char>(k[i] ^ 0x36));  // ipad
        outer.push_back(static_cast<unsigned char>(k[i] ^ 0x5c));  // opad
    }
    inner.insert(inner.end(), message.begin(), message.end());

    const std::vector<unsigned char> innerHash = sha256Raw(inner);
    outer.insert(outer.end(), innerHash.begin(), innerHash.end());
    return toHex(sha256Raw(outer));
}

std::string randomSalt(std::size_t bytes) {
    std::random_device rd;
    std::vector<unsigned char> raw(bytes);
    for (auto& byte : raw) {
        byte = static_cast<unsigned char>(rd() & 0xFFu);
    }
    return toHex(raw);
}

std::string randomToken(std::size_t bytes) {
    return randomSalt(bytes);  // same source; separate name documents intent
}

std::string hashPassword(const std::string& password, const std::string& salt) {
    return sha256Hex(salt + ":" + password);
}

bool constantTimeEquals(const std::string& a, const std::string& b) noexcept {
    if (a.size() != b.size()) {
        return false;
    }
    unsigned char diff = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        diff |= static_cast<unsigned char>(a[i]) ^ static_cast<unsigned char>(b[i]);
    }
    return diff == 0;
}

}  // namespace ctf::crypto
