// ctf_server — REST server entry point.
//
// Phase 0: a minimal, real httplib server that answers GET /api/health with the
// standard success envelope and, if a web directory is supplied, serves it as a
// static SPA. The full ApiRouter and every /api/... endpoint arrive in Phase 6.
//
// This is the ONLY layer permitted to do I/O / HTTP (CLAUDE.md rule #4). It holds
// no game rules.

#include <atomic>
#include <csignal>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "ctf/Version.hpp"

namespace {

using json = nlohmann::json;

struct Options {
    int port = 8080;
    std::string dataDir = "data/runtime";
    std::string webDir;         // empty -> API only
    std::string secretFile;     // empty -> read CTF_SERVER_SECRET or generate
};

Options parseArgs(int argc, char** argv) {
    Options opt;
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        auto next = [&](const char* name) -> std::string {
            if (i + 1 >= argc) {
                std::cerr << "missing value for " << name << "\n";
                std::exit(2);
            }
            return argv[++i];
        };
        if (arg == "--port") {
            opt.port = std::stoi(next("--port"));
        } else if (arg == "--data") {
            opt.dataDir = next("--data");
        } else if (arg == "--web") {
            opt.webDir = next("--web");
        } else if (arg == "--secret-file") {
            opt.secretFile = next("--secret-file");
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "usage: ctf_server [--port N] [--data DIR] [--web DIR] "
                         "[--secret-file FILE]\n";
            std::exit(0);
        } else {
            std::cerr << "unknown argument: " << arg << "\n";
            std::exit(2);
        }
    }
    return opt;
}

// Success envelope: { "ok": true, "data": ... }  (docs/PLAYBOOK.md §7).
json ok(json data) {
    return json{{"ok", true}, {"data", std::move(data)}};
}

std::atomic<httplib::Server*> g_server{nullptr};

void handleSignal(int) {
    if (auto* srv = g_server.load()) {
        srv->stop();
    }
}

}  // namespace

int main(int argc, char** argv) {
    const Options opt = parseArgs(argc, argv);

    httplib::Server server;
    g_server.store(&server);
    std::signal(SIGINT, handleSignal);
    std::signal(SIGTERM, handleSignal);

    server.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(
            ok(json{{"status", "up"}, {"version", ctf::version()}}).dump(),
            "application/json");
    });

    // Optional static frontend (production: ctf_server serves frontend/dist).
    if (!opt.webDir.empty()) {
        if (server.set_mount_point("/", opt.webDir)) {
            // SPA fallback: any non-/api route that isn't a real file -> index.html.
            server.set_file_request_handler(
                [&opt](const httplib::Request& req, httplib::Response& res) {
                    if (req.path.rfind("/api/", 0) == 0) {
                        return;  // let the 404 stand for unknown API routes
                    }
                    std::ifstream index(opt.webDir + "/index.html", std::ios::binary);
                    if (index) {
                        std::string body((std::istreambuf_iterator<char>(index)),
                                         std::istreambuf_iterator<char>());
                        res.set_content(body, "text/html");
                    }
                });
        } else {
            std::cerr << "warning: could not mount web dir: " << opt.webDir << "\n";
        }
    }

    std::cout << "ctf_server " << ctf::version() << " listening on http://localhost:"
              << opt.port << "  (data=" << opt.dataDir
              << (opt.webDir.empty() ? ", api-only" : ", web=" + opt.webDir) << ")\n";

    if (!server.listen("0.0.0.0", opt.port)) {
        std::cerr << "failed to bind port " << opt.port << "\n";
        return 1;
    }
    std::cout << "ctf_server stopped.\n";
    return 0;
}
