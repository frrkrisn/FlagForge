#include <catch2/catch_test_macros.hpp>

#include <string>
#include <thread>
#include <vector>

#include "ctf/app/CTFManager.hpp"
#include "ctf/app/Metrics.hpp"
#include "support.hpp"

using namespace ctf;
using namespace ctf::app;

namespace {
bool has(const std::string& text, const std::string& needle) { return text.find(needle) != std::string::npos; }
}  // namespace

TEST_CASE("Metrics counts requests by method and status", "[app][metrics]") {
    Metrics m;
    m.observeRequest("GET", 200, 0.002);
    m.observeRequest("GET", 200, 0.004);
    m.observeRequest("POST", 403, 0.020);

    const std::string out = m.render(StatsDto{}, "9.9.9");
    REQUIRE(has(out, "flagforge_http_requests_total{method=\"GET\",status=\"200\"} 2"));
    REQUIRE(has(out, "flagforge_http_requests_total{method=\"POST\",status=\"403\"} 1"));
    REQUIRE(has(out, "flagforge_build_info{version=\"9.9.9\"} 1"));
    REQUIRE(has(out, "# TYPE flagforge_http_requests_total counter"));
}

TEST_CASE("The latency histogram is cumulative and ends at +Inf", "[app][metrics]") {
    Metrics m;
    m.observeRequest("GET", 200, 0.0005);  // <= 0.001
    m.observeRequest("GET", 200, 0.007);   // <= 0.01
    m.observeRequest("GET", 200, 5.0);     // only +Inf

    const std::string out = m.render(StatsDto{}, "v");
    REQUIRE(has(out, "flagforge_http_request_duration_seconds_bucket{le=\"0.001000\"} 1"));
    REQUIRE(has(out, "flagforge_http_request_duration_seconds_bucket{le=\"0.010000\"} 2"));
    REQUIRE(has(out, "flagforge_http_request_duration_seconds_bucket{le=\"1.000000\"} 2"));
    REQUIRE(has(out, "flagforge_http_request_duration_seconds_bucket{le=\"+Inf\"} 3"));
    REQUIRE(has(out, "flagforge_http_request_duration_seconds_count 3"));
}

TEST_CASE("Metrics tracks open SSE connections", "[app][metrics]") {
    Metrics m;
    m.sseConnected();
    m.sseConnected();
    m.sseDisconnected();
    REQUIRE(m.sseClients() == 1);
    REQUIRE(has(m.render(StatsDto{}, "v"), "flagforge_sse_clients 1"));
}

TEST_CASE("Metrics is safe to update from many threads", "[app][metrics][concurrency]") {
    Metrics m;
    std::vector<std::thread> threads;
    for (int t = 0; t < 8; ++t) {
        threads.emplace_back([&m] {
            for (int i = 0; i < 500; ++i) m.observeRequest("GET", 200, 0.001);
        });
    }
    for (auto& t : threads) t.join();
    REQUIRE(has(m.render(StatsDto{}, "v"), "flagforge_http_requests_total{method=\"GET\",status=\"200\"} 4000"));
}

TEST_CASE("Game gauges reflect real activity", "[app][metrics][manager]") {
    CTFManager mgr("test-secret", ctftest::makeTempDir(), std::make_unique<ctftest::FakeClock>());
    auto admin = mgr.registerUser("admin", "admin@x.com", "password123");
    auto alice = mgr.registerUser("alice", "alice@x.com", "password123");
    mgr.createTeam(alice.me.id, "Alpha");

    ChallengeSpec s;
    s.id = "c_1";
    s.title = "c_1";
    s.basePoints = 100;
    s.scoring = ScoringKind::Static;
    s.flagType = FlagType::Static;
    s.flag = "CTF{x}";
    mgr.createChallenge(admin.me.id, s);
    mgr.startEvent(admin.me.id);
    mgr.submitFlag(alice.me.id, "c_1", "CTF{wrong}");
    mgr.submitFlag(alice.me.id, "c_1", "CTF{x}");

    const StatsDto stats = mgr.stats();
    REQUIRE(stats.users == 2);
    REQUIRE(stats.teams == 1);
    REQUIRE(stats.challenges == 1);
    REQUIRE(stats.solves == 1);
    REQUIRE(stats.eventState == "RUNNING");
    REQUIRE(stats.submissionsByResult.at("CORRECT") == 1);
    REQUIRE(stats.submissionsByResult.at("WRONG") == 1);
    REQUIRE(stats.submissionsByResult.at("FLAG_SHARING") == 0);  // present even at zero

    Metrics m;
    const std::string out = m.render(stats, "v");
    REQUIRE(has(out, "flagforge_solves 1.000000"));
    REQUIRE(has(out, "flagforge_event_state{state=\"RUNNING\"} 1"));
    REQUIRE(has(out, "flagforge_event_state{state=\"ENDED\"} 0"));
    REQUIRE(has(out, "flagforge_submissions_total{result=\"WRONG\"} 1"));
}
