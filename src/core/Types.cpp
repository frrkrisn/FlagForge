#include "ctf/core/Types.hpp"

#include <array>
#include <cstdio>
#include <ctime>

#include "ctf/Exceptions.hpp"

namespace ctf {

// --- time --------------------------------------------------------------------
namespace {

std::tm toUtcTm(std::time_t tt) {
    std::tm out{};
#if defined(_WIN32)
    gmtime_s(&out, &tt);
#else
    gmtime_r(&tt, &out);
#endif
    return out;
}

std::time_t fromUtcTm(std::tm& tm) {
#if defined(_WIN32)
    return _mkgmtime(&tm);
#else
    return timegm(&tm);
#endif
}

}  // namespace

std::string toIso8601(TimePoint tp) {
    const std::time_t tt = Clock::to_time_t(tp);
    std::tm tm = toUtcTm(tt);
    std::array<char, 32> buf{};
    std::strftime(buf.data(), buf.size(), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return std::string(buf.data());
}

TimePoint fromIso8601(const std::string& iso) {
    std::tm tm{};
    int y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0;
    // Accept "YYYY-MM-DDTHH:MM:SSZ" (Z optional).
    if (std::sscanf(iso.c_str(), "%d-%d-%dT%d:%d:%d", &y, &mo, &d, &h, &mi, &s) != 6) {
        throw ValidationException("Malformed ISO-8601 timestamp: " + iso);
    }
    tm.tm_year = y - 1900;
    tm.tm_mon = mo - 1;
    tm.tm_mday = d;
    tm.tm_hour = h;
    tm.tm_min = mi;
    tm.tm_sec = s;
    tm.tm_isdst = 0;
    const std::time_t tt = fromUtcTm(tm);
    if (tt == static_cast<std::time_t>(-1)) {
        throw ValidationException("Invalid calendar date: " + iso);
    }
    return Clock::from_time_t(tt);
}

// --- enum -> string ----------------------------------------------------------
const char* toString(Role r) noexcept {
    switch (r) {
        case Role::Player: return "PLAYER";
        case Role::Admin: return "ADMIN";
    }
    return "PLAYER";
}

const char* toString(Category c) noexcept {
    switch (c) {
        case Category::Web: return "WEB";
        case Category::Crypto: return "CRYPTO";
        case Category::Forensics: return "FORENSICS";
        case Category::Reverse: return "REVERSE";
        case Category::Pwn: return "PWN";
        case Category::Misc: return "MISC";
    }
    return "MISC";
}

const char* toString(Difficulty d) noexcept {
    switch (d) {
        case Difficulty::Easy: return "EASY";
        case Difficulty::Medium: return "MEDIUM";
        case Difficulty::Hard: return "HARD";
    }
    return "EASY";
}

const char* toString(SubmitResult s) noexcept {
    switch (s) {
        case SubmitResult::Correct: return "CORRECT";
        case SubmitResult::Wrong: return "WRONG";
        case SubmitResult::AlreadySolved: return "ALREADY_SOLVED";
        case SubmitResult::Locked: return "LOCKED";
        case SubmitResult::Cooldown: return "COOLDOWN";
        case SubmitResult::Closed: return "CLOSED";
        case SubmitResult::FlagSharing: return "FLAG_SHARING";
    }
    return "WRONG";
}

const char* toString(Severity s) noexcept {
    switch (s) {
        case Severity::Info: return "INFO";
        case Severity::Warning: return "WARNING";
        case Severity::Critical: return "CRITICAL";
    }
    return "INFO";
}

const char* toString(EventState s) noexcept {
    switch (s) {
        case EventState::NotStarted: return "NOT_STARTED";
        case EventState::Running: return "RUNNING";
        case EventState::Paused: return "PAUSED";
        case EventState::Ended: return "ENDED";
    }
    return "NOT_STARTED";
}

// --- string -> enum ----------------------------------------------------------
Role roleFromString(const std::string& s) {
    if (s == "PLAYER") return Role::Player;
    if (s == "ADMIN") return Role::Admin;
    throw ValidationException("Unknown role: " + s);
}

Category categoryFromString(const std::string& s) {
    if (s == "WEB") return Category::Web;
    if (s == "CRYPTO") return Category::Crypto;
    if (s == "FORENSICS") return Category::Forensics;
    if (s == "REVERSE") return Category::Reverse;
    if (s == "PWN") return Category::Pwn;
    if (s == "MISC") return Category::Misc;
    throw ValidationException("Unknown category: " + s);
}

Difficulty difficultyFromString(const std::string& s) {
    if (s == "EASY") return Difficulty::Easy;
    if (s == "MEDIUM") return Difficulty::Medium;
    if (s == "HARD") return Difficulty::Hard;
    throw ValidationException("Unknown difficulty: " + s);
}

Severity severityFromString(const std::string& s) {
    if (s == "INFO") return Severity::Info;
    if (s == "WARNING") return Severity::Warning;
    if (s == "CRITICAL") return Severity::Critical;
    throw ValidationException("Unknown severity: " + s);
}

SubmitResult submitResultFromString(const std::string& s) {
    if (s == "CORRECT") return SubmitResult::Correct;
    if (s == "WRONG") return SubmitResult::Wrong;
    if (s == "ALREADY_SOLVED") return SubmitResult::AlreadySolved;
    if (s == "LOCKED") return SubmitResult::Locked;
    if (s == "COOLDOWN") return SubmitResult::Cooldown;
    if (s == "CLOSED") return SubmitResult::Closed;
    if (s == "FLAG_SHARING") return SubmitResult::FlagSharing;
    throw ValidationException("Unknown submit result: " + s);
}

}  // namespace ctf
