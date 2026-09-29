# FlagForge — Project Report

*CTF Competition Management System — C++17 backend + React/TypeScript frontend*

---

## 1. Introduction and problem statement

A Capture-The-Flag (CTF) event needs software to host challenges, let teams register and submit
flags, and rank everyone on a live leaderboard. Off-the-shelf platforms exist, but building one is
an unusually good object-oriented programming exercise: the domain has natural class hierarchies
(users, challenge types, scoring rules), natural events (one solve triggers many reactions), and
genuine uses for the classic design patterns rather than toy examples.

**FlagForge** is a complete, working CTF platform. An admin hosts an event; teams register and
solve challenges by submitting flags; a live leaderboard ranks them with real-CTF mechanics:
dynamic (decaying) scoring, first blood, costed hints, per-team dynamic flags, anti-cheat, and a
scoreboard freeze. The whole product is a website served by a C++ HTTP server, with all game logic
kept in a pure, I/O-free C++ core library so the OOP design stays clean and testable.

## 2. Requirements

The functional (FR-01…FR-25) and non-functional (NFR-01…NFR-14) requirements are catalogued in
[`docs/PLAYBOOK.md`](PLAYBOOK.md) §2. Highlights that shaped the design:

- **Must:** register/login, teams (capacity 4, captain, invite codes), challenge board, flag
  submission with typed results, points-once-per-team, live leaderboard with tie-break, admin event
  control, dynamic scoring, first blood, costed hints, per-team flags, observer-driven feed,
  scoreboard freeze, JSON persistence.
- **Non-functional:** C++17 + CMake, no raw `new`/`delete`, core has no I/O, server is thread-safe,
  flags never stored/sent in plaintext, salted password hashes, typed exceptions → HTTP codes,
  React 18 + strict TypeScript frontend, responsive + accessible UI.

## 3. System architecture

```
Browser (React 18 + TS SPA)
        │  HTTP + JSON (HttpOnly cookie session), SSE
ctf::server  (ApiRouter, cpp-httplib)   — routes, auth, JSON<->DTO, error mapping; serves the SPA
        │  calls
ctf::app     (CTFManager facade + std::shared_mutex)   — the single source of truth
        │
ctf::core / ctf::scoring / ctf::events   — domain, Strategy scoring, Observer events (no I/O)
        │
ctf::persistence   (Repository<T>, JsonStore)   — atomic JSON save/load
```

**Rules of the architecture.** Dependencies point downward only; core never includes server
headers. The server layer contains no game rules — it parses a request, calls `CTFManager`, and
formats the response. The React app holds no game rules either: it never computes ranks, points or
flag validity; the server is authoritative. See [`docs/uml/`](uml/) for the class, sequence and
use-case diagrams and [`docs/api.md`](api.md) for the full API contract.

## 4. Class design and UML

The complete class model is in [`docs/uml/class-diagram.md`](uml/class-diagram.md); the central
"submit a flag" flow is in [`docs/uml/sequence-submit-flag.md`](uml/sequence-submit-flag.md); actors
and use cases are in [`docs/uml/use-cases.md`](uml/use-cases.md). Key types:

- `User` (abstract) → `Player`, `Admin`; `Team`; `Hint`.
- `Challenge` (abstract) → `StaticChallenge`, `DynamicFlagChallenge`, `MultiFlagChallenge`; built by
  `ChallengeFactory`.
- `IScoringStrategy` → `StaticScoring`, `DecayScoring`, `FirstBloodScoring` (a decorator).
- `IEventObserver` → `ActivityFeed`, `EventLog`, `AntiCheatMonitor`; published to by `EventBus`.
- `Repository<T>` (template), `JsonStore`; `SessionManager`; `CTFManager` (facade).

## 5. OOP concepts implemented

Every concept is present in real, exercised code with `file:line` references in
[`docs/uml/oop-mapping.md`](uml/oop-mapping.md): encapsulation, abstraction, inheritance, runtime
and compile-time polymorphism, composition/aggregation, operator overloading, templates, a friend
function, static members, a custom exception hierarchy, RAII/smart pointers, the Rule of Five, STL
algorithms + lambdas, `enum class`, `const` correctness and namespaces.

## 6. Design patterns used and why

| Pattern | Where | Why (not `if/else`) |
|---|---|---|
| **Strategy** | `IScoringStrategy` + `StaticScoring`/`DecayScoring` | Each challenge owns its own scoring behaviour by value; adding a scoring rule adds a class, no `switch` on type. |
| **Decorator** | `FirstBloodScoring` wraps another strategy | The first-blood bonus composes with *any* base scoring without subclassing every combination. |
| **Observer** | `EventBus` + `ActivityFeed`/`EventLog`/`AntiCheatMonitor` | A solve fans out to many reactions; adding a new observer needs **zero** changes to `CTFManager::submitFlag`. |
| **Factory** | `ChallengeFactory` | Builds the right `Challenge` subclass from a declarative spec and hashes plaintext flags in one place. |
| **Facade** | `CTFManager` | Gives the server one coherent, lock-guarded surface over the whole domain. |

## 7. Novelty features

- **Dynamic scoring** — CTFd-style parabolic decay; scores are *derived* from solve records, so when
  a challenge decays every solver drops together (real-CTF behaviour). `Scoreboard` recomputes on
  demand.
- **First blood** — the first solver gets a +10% bonus (via the decorator) and a badge; an event is
  published.
- **Costed hints** — unlocking deducts points; idempotent per team.
- **Per-team dynamic flags** — `CTF{hex(HMAC(serverSecret, challengeId:teamId))[0:24]}`; submitting
  another team's flag is detected as **flag sharing** and alerted.
- **Observer-driven live feed** — solves, first bloods and events stream to clients over SSE.
- **Scoreboard freeze** — the public board returns a snapshot after the freeze time; the admin board
  stays live.
- **Anti-cheat** — wrong-attempt cooldown, flag-sharing, submission-burst and same-wrong-flag alerts.
- **Challenge dependency tree** — DFS-validated prerequisites; a challenge is `LOCKED` until its
  prerequisites are solved.
- **Themeable hacker-terminal UI** — 7 presets + custom accent, effect toggles, all via CSS-variable
  tokens with a WCAG contrast guard.

## 8. Implementation highlights

- **Thread-safety.** `CTFManager` owns a single `std::shared_mutex`: read endpoints take a shared
  lock, mutating endpoints a unique lock. A multithreaded stress test (8 concurrent submissions)
  confirms exactly one team wins first blood and no updates are lost.
- **Persistence.** `JsonStore` writes to a temp file and atomically renames, so a crash mid-write
  never corrupts the data file; state round-trips across a restart (scores and logins survive).
- **Security.** Flags are stored/compared only as SHA-256 hashes with a constant-time compare;
  passwords are salted+hashed; sessions are 128-bit random, HttpOnly, SameSite=Strict, expiring; the
  server secret is loaded from file/env, never committed; player-facing responses never contain a
  flag or hint text (verified by test).

## 9. Testing

| Level | Tool | Coverage |
|---|---|---|
| Unit / property | Catch2 v3 | Every core class, success and failure paths; decay monotonicity; ranking order |
| Concurrency | Catch2 + threads | N concurrent submissions produce consistent scores and one first blood |
| Integration | Catch2 | Full submit-flag matrix, per-team flags + sharing, persistence round-trip |
| API | curl (live) | Auth, permissions, envelope, **no flag leak**, 403 for players on admin routes |
| Frontend | Vitest + RTL | Envelope client; components; screenshot-verified in two presets |
| CI | GitHub Actions | C++ build+`ctest` on Ubuntu & Windows; Node lint/typecheck/test/build |

**Result:** 61 backend tests pass; the frontend typechecks, lints, tests and builds; the server was
verified end-to-end over HTTP and populated with a 12-team demo via `scripts/seed.mjs`.

Sanitizer builds are wired but opt-in (`-DCTF_ENABLE_ASAN=ON`, `-DCTF_ENABLE_TSAN=ON`) for a Phase-9
hardening pass on a Linux toolchain.

## 10. Screenshots

Captured from the running app (see the conversation / `docs/` when exported): the landing page in
Matrix Green, the theme customizer with all seven presets, the same page recolored to the light
Paper preset, and the populated live scoreboard with medals, category dots and identicons.

## 11. Challenges faced and lessons learned

- **Keeping the core I/O-free** forced a clean separation: the domain takes data in and returns data
  or throws, which made it trivially unit-testable without a server.
- **Deriving scores instead of storing them** was the key insight for correct decay — a stored score
  would drift out of sync as challenges decayed.
- **Threading**: funnelling all state through one `shared_mutex` in the facade kept concurrency
  reasoning to a single place instead of scattered locks.
- **Toolchain**: modern CMake (4.x) rejects dependencies that request an old policy minimum; a single
  `CMAKE_POLICY_VERSION_MINIMUM` floor fixed FetchContent for nlohmann/json and picosha2.

## 12. Future scope

Containerised/VM-hosted challenges, in-app team chat, OAuth/email verification, a real database,
multi-event support, WebSocket push in place of polling SSE, and the full realism/accessibility audit
(PLAYBOOK §8.5 R-items) with Playwright + axe end-to-end tests.

## 13. Individual contribution

| Area | Modules |
|---|---|
| Core domain | `ctf::core` (users, teams, challenges, factory, crypto, graph) |
| Scoring & events | `ctf::scoring`, `ctf::events` (strategies, scoreboard, bus, anti-cheat) |
| Backend / platform | `ctf::persistence`, `ctf::app` (CTFManager), `ctf::server`, CMake, CI |
| Frontend | `frontend/` React app, theme system, seed/demo script |

*(Fill in team member names per your group. This build was produced phase-by-phase as one codebase.)*

## 14. References

- docs/PLAYBOOK.md — full specification
- docs/api.md — REST + SSE contract
- docs/uml/ — class, sequence, use-case diagrams; OOP mapping
- CTFd (scoring model inspiration), RFC 2104/4231 (HMAC), NIST SHA-256 test vectors
- cpp-httplib, nlohmann/json, picosha2, Catch2; React, Vite, Tailwind, TanStack Query
