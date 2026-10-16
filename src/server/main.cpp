// ctf_server — REST server entry point.
//
// Wires the CTFManager (all game rules + state, thread-safe) to the ApiRouter (HTTP
// boundary, no game rules), serves the built React app, and runs an httplib server
// with a thread pool sized for many long-lived SSE streams.

#include <atomic>
#include <csignal>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <iterator>
#include <memory>
#include <string>

#include <httplib.h>

#include "ctf/Version.hpp"
#include "ctf/app/CTFManager.hpp"
#include "ctf/core/Crypto.hpp"
#include "ctf/server/ApiRouter.hpp"

namespace {

struct Options {
    int port = 8080;
    std::string dataDir = "data/runtime";
    std::string webDir;
    std::string secretFile;
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

// Server secret for per-team dynamic flags: file, then env, then a generated one.
std::string loadServerSecret(const Options& opt) {
    if (!opt.secretFile.empty()) {
        std::ifstream in(opt.secretFile, std::ios::binary);
        if (in) {
            std::string secret((std::istreambuf_iterator<char>(in)),
                               std::istreambuf_iterator<char>());
            while (!secret.empty() && (secret.back() == '\n' || secret.back() == '\r')) {
                secret.pop_back();
            }
            if (!secret.empty()) return secret;
        }
        std::cerr << "warning: could not read secret file " << opt.secretFile << "\n";
    }
    if (const char* env = std::getenv("CTF_SERVER_SECRET"); env && *env) {
        return env;
    }
    std::cerr << "warning: no server secret provided; generating an ephemeral one "
                 "(dynamic flags change on restart). Use --secret-file for stability.\n";
    return ctf::crypto::randomToken(32);
}

std::atomic<httplib::Server*> g_server{nullptr};
void handleSignal(int) {
    if (auto* srv = g_server.load()) srv->stop();
}

}  // namespace

int main(int argc, char** argv) {
    const Options opt = parseArgs(argc, argv);
    const std::string secret = loadServerSecret(opt);

    ctf::app::CTFManager manager(secret, opt.dataDir);
    manager.load();

    httplib::Server server;
    // Size the pool for many concurrent long-lived SSE streams (PLAYBOOK §6 / Prompt 6).
    server.new_task_queue = [] { return new httplib::ThreadPool(64); };

    ctf::server::ApiRouter router(manager);
    router.registerRoutes(server);

    // Serve the built React app (production) with SPA fallback.
    if (!opt.webDir.empty()) {
        if (server.set_mount_point("/", opt.webDir)) {
            // SPA fallback: an unknown GET that is not an API/metrics call or a file gets the app
            // shell, so deep links and refreshes (e.g. /challenges) work.
            server.set_error_handler([&opt](const httplib::Request& req, httplib::Response& res) {
                if (res.status != 404 || req.method != "GET") return;
                if (req.path.rfind("/api/", 0) == 0 || req.path == "/metrics") return;
                if (req.path.find('.') != std::string::npos) return;
                std::ifstream index(opt.webDir + "/index.html", std::ios::binary);
                if (!index) return;
                std::string body((std::istreambuf_iterator<char>(index)), std::istreambuf_iterator<char>());
                res.status = 200;
                res.set_content(body, "text/html");
            });
        } else {
            std::cerr << "warning: could not mount web dir: " << opt.webDir << "\n";
        }
    }

    g_server.store(&server);
    std::signal(SIGINT, handleSignal);
    std::signal(SIGTERM, handleSignal);

    std::cout << "ctf_server " << ctf::version() << " listening on http://localhost:" << opt.port
              << "  (data=" << opt.dataDir
              << (opt.webDir.empty() ? ", api-only" : ", web=" + opt.webDir) << ")\n";

    if (!server.listen("0.0.0.0", opt.port)) {
        std::cerr << "failed to bind port " << opt.port << "\n";
        return 1;
    }
    std::cout << "ctf_server stopped.\n";
    return 0;
}
