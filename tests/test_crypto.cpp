#include <catch2/catch_test_macros.hpp>

#include <string>

#include "ctf/core/Crypto.hpp"

using namespace ctf;

TEST_CASE("SHA-256 matches the NIST test vector for \"abc\"", "[crypto][sha256]") {
    REQUIRE(crypto::sha256Hex("abc") ==
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    REQUIRE(crypto::sha256Hex("").size() == 64);
}

TEST_CASE("HMAC-SHA256 matches RFC 4231 vectors", "[crypto][hmac]") {
    // RFC 4231, Test Case 1: key = 0x0b * 20, data = "Hi There".
    const std::string key1(20, '\x0b');
    REQUIRE(crypto::hmacSha256Hex(key1, "Hi There") ==
            "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");

    // RFC 4231, Test Case 2: key = "Jefe", data = "what do ya want for nothing?".
    REQUIRE(crypto::hmacSha256Hex("Jefe", "what do ya want for nothing?") ==
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
}

TEST_CASE("constantTimeEquals compares by value", "[crypto]") {
    REQUIRE(crypto::constantTimeEquals("deadbeef", "deadbeef"));
    REQUIRE_FALSE(crypto::constantTimeEquals("deadbeef", "deadbeff"));
    REQUIRE_FALSE(crypto::constantTimeEquals("short", "longer"));
}

TEST_CASE("random salts/tokens are unique and hex", "[crypto]") {
    const std::string a = crypto::randomToken();
    const std::string b = crypto::randomToken();
    REQUIRE(a.size() == 32);  // 16 bytes -> 32 hex chars
    REQUIRE(a != b);
    REQUIRE(a.find_first_not_of("0123456789abcdef") == std::string::npos);
}

TEST_CASE("password hashing is salted and verifiable", "[crypto]") {
    const std::string salt = crypto::randomSalt();
    const std::string hash = crypto::hashPassword("hunter2!!", salt);
    REQUIRE(crypto::constantTimeEquals(crypto::hashPassword("hunter2!!", salt), hash));
    REQUIRE_FALSE(crypto::constantTimeEquals(crypto::hashPassword("wrong", salt), hash));
}
