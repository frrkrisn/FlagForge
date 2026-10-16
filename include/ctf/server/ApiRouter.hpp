#ifndef CTF_SERVER_APIROUTER_HPP
#define CTF_SERVER_APIROUTER_HPP

/// \file ApiRouter.hpp
/// \brief The HTTP boundary. Registers every /api route on an httplib::Server, applies
///        the auth/admin middleware, maps CtfException → HTTP status + error envelope,
///        and drives the SSE stream. Contains NO game rules — it parses the request,
///        calls CTFManager, and formats the response (CLAUDE.md rule #4).

#include <string>

#include "ctf/app/Metrics.hpp"
#include "ctf/core/Types.hpp"

// Forward declarations keep httplib out of this header.
namespace httplib {
class Server;
struct Request;
struct Response;
}  // namespace httplib

namespace ctf::app {
class CTFManager;
}

namespace ctf::server {

class ApiRouter {
public:
    explicit ApiRouter(app::CTFManager& manager);

    /// Register all /api routes and the SSE endpoint on \p server.
    void registerRoutes(httplib::Server& server);

private:
    /// Resolve the session cookie to a user id, or throw AuthException. (Definition in
    /// src/server/ApiRouter.cpp reads the httplib::Request cookie header.)
    UserId requireUser(const httplib::Request& req) const;

    /// Throw PermissionException unless \p userId has the admin role.
    void requireAdmin(const UserId& userId) const;

    app::CTFManager& manager_;
    app::Metrics metrics_;  ///< request counters / latency, rendered at GET /metrics
};

}  // namespace ctf::server

#endif  // CTF_SERVER_APIROUTER_HPP
