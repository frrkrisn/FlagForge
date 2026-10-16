#include "ctf/server/ApiRouter.hpp"

#include <chrono>
#include <string>
#include <thread>
#include <vector>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "ctf/Exceptions.hpp"
#include "ctf/Version.hpp"
#include "ctf/app/CTFManager.hpp"

namespace ctf::server {

namespace {

using nlohmann::json;
using namespace ctf::app;

// --- small helpers ---------------------------------------------------------
json jTime(TimePoint t) { return json(toIso8601(t)); }
json jTime(const std::optional<TimePoint>& t) { return t ? json(toIso8601(*t)) : json(nullptr); }

std::string trim(const std::string& s) {
    const auto b = s.find_first_not_of(" \t");
    const auto e = s.find_last_not_of(" \t");
    return b == std::string::npos ? "" : s.substr(b, e - b + 1);
}

std::string getCookie(const httplib::Request& req, const std::string& name) {
    if (!req.has_header("Cookie")) return "";
    const std::string cookies = req.get_header_value("Cookie");
    std::size_t pos = 0;
    while (pos < cookies.size()) {
        const std::size_t semi = cookies.find(';', pos);
        const std::string pair =
            cookies.substr(pos, semi == std::string::npos ? std::string::npos : semi - pos);
        const std::size_t eq = pair.find('=');
        if (eq != std::string::npos && trim(pair.substr(0, eq)) == name) {
            return trim(pair.substr(eq + 1));
        }
        if (semi == std::string::npos) break;
        pos = semi + 1;
    }
    return "";
}

void setSessionCookie(httplib::Response& res, const std::string& token) {
    res.set_header("Set-Cookie",
                   "session=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200");
}
void clearSessionCookie(httplib::Response& res) {
    res.set_header("Set-Cookie", "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

// --- DTO -> JSON converters ------------------------------------------------
json toJson(const TeamSummaryDto& t) {
    return json{{"id", t.id}, {"name", t.name}, {"score", t.score}, {"rank", t.rank},
                {"solves", t.solves}};
}

json toJson(const MeDto& m) {
    json j{{"id", m.id},         {"username", m.username}, {"email", m.email},
           {"role", toString(m.role)}, {"bio", m.bio},   {"avatarSeed", m.avatarSeed},
           {"themePrefs", m.themePrefs}};
    j["team"] = m.team ? toJson(*m.team) : json(nullptr);
    return j;
}

json toJson(const UserPublicDto& u) {
    return json{{"id", u.id},
                {"username", u.username},
                {"role", toString(u.role)},
                {"bio", u.bio},
                {"avatarSeed", u.avatarSeed},
                {"teamId", u.teamId ? json(*u.teamId) : json(nullptr)},
                {"personalSolves", u.personalSolves},
                {"badges", u.badges}};
}

json toJson(const TeamMemberDto& m) {
    return json{{"id", m.id}, {"username", m.username}, {"avatarSeed", m.avatarSeed},
                {"isCaptain", m.isCaptain}, {"personalSolves", m.personalSolves}};
}

json toJson(const TeamDto& t) {
    json members = json::array();
    for (const auto& m : t.members) members.push_back(toJson(m));
    json j{{"id", t.id},         {"name", t.name},   {"captainId", t.captainId},
           {"members", members}, {"score", t.score}, {"rank", t.rank},
           {"solves", t.solves}, {"badges", t.badges}, {"solvedChallengeIds", t.solvedChallengeIds}};
    if (t.inviteCode) j["inviteCode"] = *t.inviteCode;
    return j;
}

json toJson(const PrereqRefDto& p) {
    return json{{"id", p.id}, {"title", p.title}, {"solved", p.solved}};
}

void addListItemFields(json& j, const ChallengeListItemDto& c) {
    j["id"] = c.id;
    j["title"] = c.title;
    j["category"] = toString(c.category);
    j["difficulty"] = toString(c.difficulty);
    j["basePoints"] = c.basePoints;
    j["currentPoints"] = c.currentPoints;
    j["minPoints"] = c.minPoints;
    j["decay"] = c.decay;
    j["solveCount"] = c.solveCount;
    j["solved"] = c.solved;
    j["locked"] = c.locked;
    j["firstBloodByMyTeam"] = c.firstBloodByMyTeam;
    j["hasHints"] = c.hasHints;
    json missing = json::array();
    for (const auto& p : c.missingPrerequisites) missing.push_back(toJson(p));
    j["missingPrerequisites"] = missing;
}

json toJson(const ChallengeListItemDto& c) {
    json j;
    addListItemFields(j, c);
    return j;
}

json toJson(const ChallengeDetailDto& c) {
    json j;
    addListItemFields(j, c);
    j["description"] = c.description;
    json atts = json::array();
    for (const auto& a : c.attachments)
        atts.push_back(json{{"name", a.name}, {"size", a.size}, {"sha256", a.sha256},
                            {"personalised", a.personalised}});
    j["attachments"] = atts;
    json solvers = json::array();
    for (const auto& s : c.recentSolvers)
        solvers.push_back(json{{"teamId", s.teamId}, {"teamName", s.teamName}, {"at", jTime(s.at)}});
    j["recentSolvers"] = solvers;
    json hints = json::array();
    for (const auto& h : c.hints) {
        json hj{{"id", h.id}, {"cost", h.cost}, {"unlocked", h.unlocked}};
        if (h.text) hj["text"] = *h.text;
        hints.push_back(hj);
    }
    j["hints"] = hints;
    json prereqs = json::array();
    for (const auto& p : c.prerequisites) prereqs.push_back(toJson(p));
    j["prerequisites"] = prereqs;
    j["scoring"] = json{{"strategy", c.scoring.strategy}, {"initial", c.scoring.initial},
                        {"min", c.scoring.min}, {"decay", c.scoring.decay},
                        {"current", c.scoring.current}};
    return j;
}

json toJson(const SubmitOutcome& o) {
    json j{{"result", toString(o.result)}};
    if (o.awardedPoints) j["awardedPoints"] = *o.awardedPoints;
    if (o.firstBlood) j["firstBlood"] = *o.firstBlood;
    if (o.attemptsLeft) j["attemptsLeft"] = *o.attemptsLeft;
    if (o.cooldownSecondsLeft) j["cooldownSecondsLeft"] = *o.cooldownSecondsLeft;
    if (o.newTeamScore) j["newTeamScore"] = *o.newTeamScore;
    return j;
}

json toJson(const EventStatusDto& s) {
    return json{{"state", toString(s.state)}, {"startAt", jTime(s.startAt)},
                {"endAt", jTime(s.endAt)},    {"freezeAt", jTime(s.freezeAt)},
                {"frozen", s.frozen},         {"serverTime", jTime(s.serverTime)}};
}

json toJson(const scoring::RankRow& r) {
    json cats = json::object();
    for (const auto& [cat, n] : r.categorySolves) cats[toString(cat)] = n;
    return json{{"rank", r.rank},        {"teamId", r.teamId},   {"teamName", r.teamName},
                {"avatarSeed", r.avatarSeed}, {"score", r.score}, {"solves", r.solves},
                {"lastSolveAt", jTime(r.lastSolveAt)}, {"categorySolves", cats},
                {"rankDelta", r.rankDelta}};
}

json toJson(const events::Event& e) {
    json j{{"type", events::toString(e.type)}, {"at", jTime(e.timestamp)}, {"message", e.message}};
    if (e.teamId) j["teamId"] = *e.teamId;
    if (e.challengeId) j["challengeId"] = *e.challengeId;
    if (e.points) j["points"] = e.points;
    return j;
}

json toJson(const events::Alert& a) {
    return json{{"id", a.id},
                {"kind", events::toString(a.kind)},
                {"status", events::toString(a.status)},
                {"at", jTime(a.at)},
                {"evidence", a.evidence},
                {"teams", a.teams},
                {"challengeId", a.challengeId ? json(*a.challengeId) : json(nullptr)}};
}

json toJson(const Announcement& a) {
    return json{{"id", a.id}, {"title", a.title}, {"body", a.body},
                {"severity", toString(a.severity)}, {"at", jTime(a.timestamp)}};
}

json toJson(const SubmissionDto& s) {
    return json{{"id", s.id},         {"at", jTime(s.at)}, {"teamName", s.teamName},
                {"playerName", s.playerName}, {"challengeTitle", s.challengeTitle},
                {"result", toString(s.result)}};
}

ChallengeSpec parseSpec(const json& b) {
    ChallengeSpec s;
    s.title = b.at("title").get<std::string>();
    s.category = categoryFromString(b.value("category", std::string("MISC")));
    s.difficulty = difficultyFromString(b.value("difficulty", std::string("EASY")));
    s.description = b.value("description", std::string());
    s.basePoints = b.value("basePoints", 100);
    const json sc = b.value("scoring", json::object());
    s.scoring = ChallengeFactory::scoringKindFromString(sc.value("strategy", std::string("DECAY")));
    s.minPoints = sc.value("minPoints", s.basePoints / 5);
    s.decay = sc.value("decay", 10);
    s.flagType = ChallengeFactory::flagTypeFromString(b.value("flagType", std::string("STATIC")));
    s.flag = b.value("flag", std::string());
    s.flagPrefix = b.value("flagPrefix", std::string("CTF"));
    s.prerequisites = b.value("prerequisites", std::vector<ChallengeId>{});
    for (const auto& h : b.value("hints", json::array())) {
        s.hints.push_back(HintSpec{h.at("text").get<std::string>(), h.value("cost", 0)});
    }
    for (const auto& a : b.value("attachments", json::array())) {
        s.attachments.push_back(Attachment{a.at("name").get<std::string>(),
                                            a.value("size", static_cast<std::size_t>(0))});
    }
    s.visible = b.value("visible", true);
    return s;
}

}  // namespace

// ---------------------------------------------------------------------------
ApiRouter::ApiRouter(app::CTFManager& manager) : manager_(manager) {}

UserId ApiRouter::requireUser(const httplib::Request& req) const {
    const std::string token = getCookie(req, "session");
    if (token.empty()) throw AuthException("You must be signed in");
    auto uid = manager_.userIdForToken(token);
    if (!uid) throw AuthException("Your session has expired");
    return *uid;
}

void ApiRouter::requireAdmin(const UserId& userId) const {
    if (manager_.roleOf(userId) != Role::Admin) {
        throw PermissionException("Admin privileges required");
    }
}

namespace {

void writeOk(httplib::Response& res, const json& data) {
    res.status = 200;
    res.set_content(json{{"ok", true}, {"data", data}}.dump(), "application/json");
}

void writeFail(httplib::Response& res, int status, const std::string& code,
               const std::string& message) {
    res.status = status;
    res.set_content(json{{"ok", false}, {"error", {{"code", code}, {"message", message}}}}.dump(),
                    "application/json");
}

// Run a handler that returns the response `data`, translating exceptions into the
// failure envelope with the right HTTP status.
template <typename Fn>
void guarded(httplib::Response& res, Fn fn) {
    try {
        writeOk(res, fn());
    } catch (const CtfException& e) {
        writeFail(res, e.httpStatus(), e.code(), e.what());
    } catch (const nlohmann::json::exception&) {
        writeFail(res, 400, "VALIDATION", "Malformed request body");
    } catch (const std::exception&) {
        writeFail(res, 500, "INTERNAL", "Internal server error");
    }
}

json parseBody(const httplib::Request& req) {
    if (req.body.empty()) return json::object();
    return json::parse(req.body);
}

}  // namespace

void ApiRouter::registerRoutes(httplib::Server& server) {
    auto& mgr = manager_;

    // Attachments are uploaded as a raw request body (up to 25 MB + headroom).
    server.set_payload_max_length(30u * 1024u * 1024u);

    server.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        writeOk(res, json{{"status", "up"}, {"version", ctf::version()}});
    });

    // --- auth ---
    server.Post("/api/auth/register", [&mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const json b = parseBody(req);
            auto out = mgr.registerUser(b.at("username").get<std::string>(),
                                        b.at("email").get<std::string>(),
                                        b.at("password").get<std::string>());
            setSessionCookie(res, out.token);
            return json{{"user", toJson(out.me)}};
        });
    });
    server.Post("/api/auth/login", [&mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const json b = parseBody(req);
            auto out = mgr.login(b.at("username").get<std::string>(),
                                 b.at("password").get<std::string>());
            setSessionCookie(res, out.token);
            return json{{"user", toJson(out.me)}};
        });
    });
    server.Post("/api/auth/logout", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            (void)requireUser(req);
            mgr.logout(getCookie(req, "session"));
            clearSessionCookie(res);
            return json{{"loggedOut", true}};
        });
    });
    server.Get("/api/auth/me", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] { return toJson(mgr.me(requireUser(req))); });
    });
    server.Patch("/api/users/me", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            const json b = parseBody(req);
            auto opt = [&](const char* k) -> std::optional<std::string> {
                return b.contains(k) ? std::optional<std::string>(b[k].get<std::string>())
                                     : std::nullopt;
            };
            return toJson(mgr.updateProfile(uid, opt("bio"), opt("avatarSeed"), opt("themePrefs")));
        });
    });
    server.Get(R"(/api/users/([^/]+))", [&mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] { return toJson(mgr.userPublic(req.matches[1])); });
    });

    // --- teams ---
    server.Post("/api/teams", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            return toJson(mgr.createTeam(uid, parseBody(req).at("name").get<std::string>()));
        });
    });
    server.Post("/api/teams/join", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            return toJson(mgr.joinTeam(uid, parseBody(req).at("inviteCode").get<std::string>()));
        });
    });
    server.Post("/api/teams/leave", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            mgr.leaveTeam(requireUser(req));
            return json{{"left", true}};
        });
    });
    server.Get("/api/teams/me", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] { return toJson(mgr.myTeam(requireUser(req))); });
    });
    server.Post("/api/teams/me/kick", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            return toJson(mgr.kickMember(uid, parseBody(req).at("playerId").get<std::string>()));
        });
    });
    server.Post("/api/teams/me/invite/regenerate",
                [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                    guarded(res, [&] {
                        return json{{"inviteCode", mgr.regenerateInvite(requireUser(req))}};
                    });
                });
    server.Get(R"(/api/teams/([^/]+))", [&mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] { return toJson(mgr.teamPublic(req.matches[1])); });
    });

    // --- event & challenges ---
    server.Get("/api/event/status", [&mgr](const httplib::Request&, httplib::Response& res) {
        guarded(res, [&] { return toJson(mgr.eventStatus()); });
    });
    server.Get("/api/challenges", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            json arr = json::array();
            for (const auto& c : mgr.listChallenges(requireUser(req))) arr.push_back(toJson(c));
            return json{{"challenges", arr}};
        });
    });
    server.Post(R"(/api/challenges/([^/]+)/submit)",
                [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                    guarded(res, [&] {
                        const UserId uid = requireUser(req);
                        return toJson(mgr.submitFlag(uid, req.matches[1],
                                                     parseBody(req).at("flag").get<std::string>()));
                    });
                });
    server.Post(R"(/api/challenges/([^/]+)/hints/([^/]+)/unlock)",
                [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                    guarded(res, [&] {
                        const UserId uid = requireUser(req);
                        auto out = mgr.unlockHint(uid, req.matches[1], req.matches[2]);
                        return json{{"hintId", out.hintId}, {"text", out.text},
                                    {"cost", out.cost}, {"newTeamScore", out.newTeamScore}};
                    });
                });
    server.Get(R"(/api/challenges/([^/]+))",
               [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                   guarded(res, [&] {
                       return toJson(mgr.challengeDetail(requireUser(req), req.matches[1]));
                   });
               });

    // --- attachments ---
    // Download is a raw binary response, so it does not use the JSON `guarded` wrapper.
    server.Get(R"(/api/challenges/([^/]+)/files/([^/]+))",
               [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                   try {
                       const UserId uid = requireUser(req);
                       const FileDownload f = mgr.downloadAttachment(uid, req.matches[1], req.matches[2]);
                       res.set_header("Content-Disposition", "attachment; filename=\"" + f.name + "\"");
                       res.set_header("X-Content-Type-Options", "nosniff");
                       res.set_content(f.bytes, f.contentType);
                   } catch (const CtfException& e) {
                       writeFail(res, e.httpStatus(), e.code(), e.what());
                   } catch (const std::exception&) {
                       writeFail(res, 500, "INTERNAL", "Internal server error");
                   }
               });
    server.Put(R"(/api/admin/challenges/([^/]+)/files/([^/]+))",
               [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                   guarded(res, [&] {
                       const UserId uid = requireUser(req);
                       requireAdmin(uid);
                       const std::string transform = req.has_param("transform") ? req.get_param_value("transform") : "";
                       const auto a = mgr.addAttachment(uid, req.matches[1], req.matches[2], req.body, transform);
                       return json{{"name", a.name}, {"size", a.size}, {"sha256", a.sha256}, {"personalised", a.personalised}};
                   });
               });
    server.Delete(R"(/api/admin/challenges/([^/]+)/files/([^/]+))",
                  [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                      guarded(res, [&] {
                          const UserId uid = requireUser(req);
                          requireAdmin(uid);
                          mgr.removeAttachment(uid, req.matches[1], req.matches[2]);
                          return json{{"deleted", true}};
                      });
                  });

    // --- scoreboard / feed / announcements ---
    server.Get("/api/scoreboard", [&mgr](const httplib::Request&, httplib::Response& res) {
        guarded(res, [&] {
            auto board = mgr.publicScoreboard();
            json rows = json::array();
            for (const auto& r : board.rows) rows.push_back(toJson(r));
            return json{{"frozen", board.frozen},
                        {"frozenAt", jTime(board.frozenAt)},
                        {"rows", rows}};
        });
    });
    server.Get("/api/scoreboard/timeline", [&mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            int top = 10;
            if (req.has_param("top")) top = std::stoi(req.get_param_value("top"));
            json teams = json::array();
            for (const auto& tl : mgr.timeline(top)) {
                json pts = json::array();
                for (const auto& p : tl.points)
                    pts.push_back(json{{"t", jTime(p.t)}, {"score", p.score}});
                teams.push_back(json{{"teamId", tl.teamId}, {"teamName", tl.teamName}, {"points", pts}});
            }
            return json{{"teams", teams}};
        });
    });
    server.Get("/api/feed", [&mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            long long since = 0;
            if (req.has_param("since")) since = std::stoll(req.get_param_value("since"));
            json events = json::array();
            for (const auto& e : mgr.feedSince(since)) events.push_back(toJson(e));
            return json{{"events", events}, {"nextSince", mgr.latestFeedId()}};
        });
    });
    server.Get("/api/announcements", [&mgr](const httplib::Request&, httplib::Response& res) {
        guarded(res, [&] {
            json arr = json::array();
            for (const auto& a : mgr.announcements()) arr.push_back(toJson(a));
            return json{{"announcements", arr}};
        });
    });

    // --- admin ---
    server.Post("/api/admin/challenges", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            requireAdmin(uid);
            return toJson(mgr.createChallenge(uid, parseSpec(parseBody(req))));
        });
    });
    server.Put(R"(/api/admin/challenges/([^/]+))",
               [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                   guarded(res, [&] {
                       const UserId uid = requireUser(req);
                       requireAdmin(uid);
                       return toJson(mgr.editChallenge(uid, req.matches[1], parseSpec(parseBody(req))));
                   });
               });
    server.Delete(R"(/api/admin/challenges/([^/]+))",
                  [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                      guarded(res, [&] {
                          const UserId uid = requireUser(req);
                          requireAdmin(uid);
                          mgr.deleteChallenge(uid, req.matches[1]);
                          return json{{"deleted", true}};
                      });
                  });
    server.Post(R"(/api/admin/challenges/([^/]+)/visibility)",
                [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                    guarded(res, [&] {
                        const UserId uid = requireUser(req);
                        requireAdmin(uid);
                        return toJson(mgr.setChallengeVisibility(uid, req.matches[1],
                                                                 parseBody(req).at("visible").get<bool>()));
                    });
                });

    auto eventAction = [this, &mgr](const std::string& action) {
        return [this, &mgr, action](const httplib::Request& req, httplib::Response& res) {
            guarded(res, [&] {
                const UserId uid = requireUser(req);
                requireAdmin(uid);
                if (action == "start") return toJson(mgr.startEvent(uid));
                if (action == "pause") return toJson(mgr.pauseEvent(uid));
                if (action == "resume") return toJson(mgr.resumeEvent(uid));
                return toJson(mgr.endEvent(uid));
            });
        };
    };
    server.Post("/api/admin/event/start", eventAction("start"));
    server.Post("/api/admin/event/pause", eventAction("pause"));
    server.Post("/api/admin/event/resume", eventAction("resume"));
    server.Post("/api/admin/event/end", eventAction("end"));
    server.Post("/api/admin/event/freeze", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            requireAdmin(uid);
            return toJson(mgr.setFreeze(uid, fromIso8601(parseBody(req).at("freezeAt").get<std::string>())));
        });
    });
    server.Get("/api/admin/scoreboard", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            json rows = json::array();
            for (const auto& r : mgr.adminScoreboard(uid)) rows.push_back(toJson(r));
            return json{{"rows", rows}};
        });
    });
    server.Get("/api/admin/submissions", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            requireAdmin(uid);
            SubmissionFilter f;
            if (req.has_param("team")) f.teamId = req.get_param_value("team");
            if (req.has_param("challenge")) f.challengeId = req.get_param_value("challenge");
            if (req.has_param("result")) f.result = submitResultFromString(req.get_param_value("result"));
            json arr = json::array();
            for (const auto& s : mgr.submissions(uid, f)) arr.push_back(toJson(s));
            return json{{"submissions", arr}};
        });
    });
    server.Get("/api/admin/alerts", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            json arr = json::array();
            for (const auto& a : mgr.alerts(uid)) arr.push_back(toJson(a));
            return json{{"alerts", arr}};
        });
    });
    server.Post(R"(/api/admin/alerts/([^/]+)/dismiss)",
                [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                    guarded(res, [&] {
                        const UserId uid = requireUser(req);
                        requireAdmin(uid);
                        mgr.dismissAlert(uid, req.matches[1]);
                        return json{{"dismissed", true}};
                    });
                });
    server.Post("/api/admin/announcements", [this, &mgr](const httplib::Request& req, httplib::Response& res) {
        guarded(res, [&] {
            const UserId uid = requireUser(req);
            requireAdmin(uid);
            const json b = parseBody(req);
            return toJson(mgr.postAnnouncement(uid, b.at("title").get<std::string>(),
                                               b.at("body").get<std::string>(),
                                               severityFromString(b.value("severity", std::string("INFO")))));
        });
    });
    server.Get(R"(/api/admin/teams/([^/]+)/flag/([^/]+))",
               [this, &mgr](const httplib::Request& req, httplib::Response& res) {
                   guarded(res, [&] {
                       const UserId uid = requireUser(req);
                       requireAdmin(uid);
                       return json{{"flag", mgr.revealTeamFlag(uid, req.matches[1], req.matches[2])}};
                   });
               });

    // --- SSE stream (polling-based fan-out; heartbeat every 15s) ---
    server.Get("/api/events/stream", [&mgr](const httplib::Request&, httplib::Response& res) {
        res.set_chunked_content_provider(
            "text/event-stream", [&mgr](std::size_t, httplib::DataSink& sink) -> bool {
                using namespace std::chrono;
                auto send = [&](const std::string& name, const json& data) -> bool {
                    const std::string chunk = "event: " + name + "\ndata: " + data.dump() + "\n\n";
                    return sink.write(chunk.data(), chunk.size());
                };
                long long lastId = 0;
                auto lastBeat = steady_clock::now();
                if (!send("event-status", toJson(mgr.eventStatus()))) return false;
                while (true) {
                    const auto events = mgr.feedSince(lastId);
                    for (const auto& e : events) {
                        if (!send("feed", toJson(e))) return false;
                    }
                    if (!events.empty()) {
                        lastId = mgr.latestFeedId();
                        auto board = mgr.publicScoreboard();
                        json rows = json::array();
                        for (const auto& r : board.rows) rows.push_back(toJson(r));
                        if (!send("scoreboard", json{{"rows", rows}})) return false;
                    }
                    if (steady_clock::now() - lastBeat > seconds(15)) {
                        const std::string hb = ": heartbeat\n\n";
                        if (!sink.write(hb.data(), hb.size())) return false;
                        if (!send("event-status", toJson(mgr.eventStatus()))) return false;
                        lastBeat = steady_clock::now();
                    }
                    std::this_thread::sleep_for(seconds(2));
                }
            });
    });
}

}  // namespace ctf::server
