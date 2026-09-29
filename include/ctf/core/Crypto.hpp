#ifndef CTF_CORE_CRYPTO_HPP
#define CTF_CORE_CRYPTO_HPP

/// \file Crypto.hpp
/// \brief Small, well-tested cryptographic helpers used across the domain:
///        SHA-256 (via picosha2), HMAC-SHA256, salted password hashing, random
///        salts/tokens, and a constant-time comparison for hashes.
///
/// Pure computation, no I/O — safe to live in ctf::core. Flags and passwords are
/// only ever stored/compared as hashes (CLAUDE.md rule #5, NFR-05/06).

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace ctf::crypto {

/// Lower-case hex encoding of any byte range. Function template → compile-time
/// polymorphism (works for std::vector<uint8_t>, std::string, std::array, ...).
template <typename ByteContainer>
std::string toHex(const ByteContainer& bytes) {
    static const char* kHexDigits = "0123456789abcdef";
    std::string out;
    out.reserve(bytes.size() * 2);
    for (unsigned char b : bytes) {
        out.push_back(kHexDigits[b >> 4]);
        out.push_back(kHexDigits[b & 0x0F]);
    }
    return out;
}

/// SHA-256 of a message, returned as 64 lower-case hex characters.
std::string sha256Hex(const std::string& message);

/// HMAC-SHA256(key, message), returned as 64 lower-case hex characters (RFC 2104).
std::string hmacSha256Hex(const std::string& key, const std::string& message);

/// Cryptographically-random salt, `bytes` long, hex-encoded.
std::string randomSalt(std::size_t bytes = 16);

/// Cryptographically-random opaque token (default 128-bit), hex-encoded.
std::string randomToken(std::size_t bytes = 16);

/// Derive a password hash from a plaintext password and a salt.
/// (SHA-256 over salt+password; documented as sufficient for this coursework.)
std::string hashPassword(const std::string& password, const std::string& salt);

/// Constant-time string comparison (no early return on first mismatch), so hash
/// comparisons don't leak timing information.
bool constantTimeEquals(const std::string& a, const std::string& b) noexcept;

}  // namespace ctf::crypto

#endif  // CTF_CORE_CRYPTO_HPP
