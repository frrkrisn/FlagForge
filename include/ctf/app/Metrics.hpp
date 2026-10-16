#ifndef CTF_APP_METRICS_HPP
#define CTF_APP_METRICS_HPP

/// \file Metrics.hpp
/// \brief Operational metrics in the Prometheus text exposition format: HTTP request counts and a
///        latency histogram, live SSE connections, process uptime, plus gauges for the game state
///        (users, teams, challenges, solves, submissions by result, open alerts, event state).
///
/// Thread-safe: request handlers call observeRequest() concurrently. No I/O; the server layer
/// decides how to expose render() (GET /metrics).

#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <map>
#include <mutex>
#include <string>

#include "ctf/app/Dtos.hpp"

namespace ctf::app {

class Metrics {
public:
    Metrics();

    /// Record one finished HTTP request.
    void observeRequest(const std::string& method, int status, double seconds);

    void sseConnected() noexcept { ++sseClients_; }
    void sseDisconnected() noexcept { --sseClients_; }
    int sseClients() const noexcept { return sseClients_.load(); }

    /// Render everything as Prometheus text. \p stats is a snapshot of the game state.
    std::string render(const StatsDto& stats, const std::string& version) const;

    /// Upper bounds (seconds) of the latency histogram buckets.
    static constexpr std::array<double, 8> kBuckets{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 1.0};

private:
    std::chrono::steady_clock::time_point start_;
    std::atomic<int> sseClients_{0};

    mutable std::mutex mutex_;
    std::map<std::pair<std::string, int>, std::uint64_t> requests_;      // (method, status) -> count
    std::array<std::uint64_t, kBuckets.size() + 1> bucketCounts_{};      // last slot = +Inf overflow
    double durationSum_ = 0.0;
    std::uint64_t durationCount_ = 0;
};

}  // namespace ctf::app

#endif  // CTF_APP_METRICS_HPP
