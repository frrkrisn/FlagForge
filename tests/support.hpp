#ifndef CTF_TESTS_SUPPORT_HPP
#define CTF_TESTS_SUPPORT_HPP

// Shared test helpers: a controllable clock and a unique temp directory factory.

#include <atomic>
#include <chrono>
#include <filesystem>
#include <string>

#include "ctf/core/Clock.hpp"

namespace ctftest {

/// A clock the test drives by hand — no sleeping in time-dependent tests.
class FakeClock final : public ctf::IClock {
public:
    explicit FakeClock(ctf::TimePoint start = ctf::Clock::now()) : t_(start) {}
    ctf::TimePoint now() const override { return t_; }
    void advance(std::chrono::seconds s) { t_ += s; }
    void set(ctf::TimePoint t) { t_ = t; }

private:
    ctf::TimePoint t_;
};

/// A fresh, unique temp directory for isolating persistence tests.
inline std::string makeTempDir() {
    static std::atomic<unsigned long long> counter{0};
    const auto stamp = std::chrono::steady_clock::now().time_since_epoch().count();
    const auto dir = std::filesystem::temp_directory_path() /
                     ("flagforge_test_" + std::to_string(stamp) + "_" +
                      std::to_string(counter.fetch_add(1)));
    std::filesystem::create_directories(dir);
    return dir.string();
}

}  // namespace ctftest

#endif  // CTF_TESTS_SUPPORT_HPP
