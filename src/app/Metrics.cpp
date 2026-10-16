#include "ctf/app/Metrics.hpp"

#include <iomanip>
#include <sstream>

namespace ctf::app {

constexpr std::array<double, 8> Metrics::kBuckets;  // C++17: needed for ODR-use of the static member

Metrics::Metrics() : start_(std::chrono::steady_clock::now()) {}

void Metrics::observeRequest(const std::string& method, int status, double seconds) {
    std::lock_guard<std::mutex> lock(mutex_);
    ++requests_[{method, status}];
    durationSum_ += seconds;
    ++durationCount_;
    std::size_t slot = kBuckets.size();  // +Inf unless a bound catches it
    for (std::size_t i = 0; i < kBuckets.size(); ++i) {
        if (seconds <= kBuckets[i]) {
            slot = i;
            break;
        }
    }
    ++bucketCounts_[slot];
}

std::string Metrics::render(const StatsDto& s, const std::string& version) const {
    std::ostringstream out;
    out << std::fixed << std::setprecision(6);

    const auto gauge = [&](const char* name, const char* help, double value) {
        out << "# HELP " << name << ' ' << help << "\n# TYPE " << name << " gauge\n"
            << name << ' ' << value << '\n';
    };
    const double uptime =
        std::chrono::duration<double>(std::chrono::steady_clock::now() - start_).count();

    out << "# HELP flagforge_build_info Build information.\n# TYPE flagforge_build_info gauge\n"
        << "flagforge_build_info{version=\"" << version << "\"} 1\n";
    gauge("flagforge_uptime_seconds", "Seconds since the server started.", uptime);
    gauge("flagforge_sse_clients", "Open live-update (SSE) connections.", static_cast<double>(sseClients()));

    gauge("flagforge_users", "Registered users.", static_cast<double>(s.users));
    gauge("flagforge_teams", "Teams.", static_cast<double>(s.teams));
    gauge("flagforge_challenges", "Challenges.", static_cast<double>(s.challenges));
    gauge("flagforge_solves", "Total correct solves across all teams.", static_cast<double>(s.solves));
    gauge("flagforge_open_alerts", "Anti-cheat alerts awaiting review.", static_cast<double>(s.openAlerts));

    out << "# HELP flagforge_event_state Current event state (1 for the active state).\n"
        << "# TYPE flagforge_event_state gauge\n";
    for (const char* name : {"NOT_STARTED", "RUNNING", "PAUSED", "ENDED"}) {
        out << "flagforge_event_state{state=\"" << name << "\"} " << (s.eventState == name ? 1 : 0) << '\n';
    }

    out << "# HELP flagforge_submissions_total Flag submissions by result.\n"
        << "# TYPE flagforge_submissions_total counter\n";
    for (const auto& [result, count] : s.submissionsByResult) {
        out << "flagforge_submissions_total{result=\"" << result << "\"} " << count << '\n';
    }

    std::lock_guard<std::mutex> lock(mutex_);
    out << "# HELP flagforge_http_requests_total HTTP requests by method and status.\n"
        << "# TYPE flagforge_http_requests_total counter\n";
    for (const auto& [key, count] : requests_) {
        out << "flagforge_http_requests_total{method=\"" << key.first << "\",status=\"" << key.second << "\"} "
            << count << '\n';
    }

    out << "# HELP flagforge_http_request_duration_seconds HTTP request latency.\n"
        << "# TYPE flagforge_http_request_duration_seconds histogram\n";
    std::uint64_t cumulative = 0;
    for (std::size_t i = 0; i < kBuckets.size(); ++i) {
        cumulative += bucketCounts_[i];
        out << "flagforge_http_request_duration_seconds_bucket{le=\"" << kBuckets[i] << "\"} " << cumulative << '\n';
    }
    cumulative += bucketCounts_[kBuckets.size()];
    out << "flagforge_http_request_duration_seconds_bucket{le=\"+Inf\"} " << cumulative << '\n'
        << "flagforge_http_request_duration_seconds_sum " << durationSum_ << '\n'
        << "flagforge_http_request_duration_seconds_count " << durationCount_ << '\n';
    return out.str();
}

}  // namespace ctf::app
