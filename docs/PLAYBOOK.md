# CTF Competition Management System: Project Playbook

> **Audience:** the project group and Claude Code.
> **Format:** C++17 backend + **React (TypeScript) web frontend** (website only, **no CLI**).
> **How to use this file:** put it in the repo as `docs/PLAYBOOK.md`. Section 4 is the `CLAUDE.md` file. Section 9 contains the prompts you paste into Claude Code, phase by phase, in order.

---

## 0. Change log (read first)

| Version | Change |
|---|---|
| v1 | CLI + optional web UI |
| v2 | **Web only.** The CLI is dropped. The whole product is a website served by a C++ backend. All game logic stays in a pure C++ core library, so the OOP marks are unaffected. |
| v3 | **React frontend** (Vite + TypeScript) with a production-grade, *realistic* UI. Backend unchanged apart from a few extra endpoints (announcements, player profiles, file downloads, live SSE stream). |
| **v3.1 (current)** | **Hacker-terminal visual identity** with a user-customizable theme system: 7 presets plus a custom accent color, effect toggles, font and density options (section 8.4). |

**Consequences of going web-only**
- The C++ program becomes a long-running HTTP server, so it must be **thread-safe** (multiple requests arrive at once).
- We need authentication (login and sessions) because there is no local user.
- The UI is now a large part of the grade impression, so it gets its own phase and owner.
- The "demo" is a browser demo with two or three browser windows acting as different teams.
- **(v3)** The frontend becomes a real project of its own (Node toolchain, design system, tests) and gets 25% of the time budget.
- **(v3)** `docs/api.md` becomes a **contract**: frontend and backend are built in parallel against it, with MSW mocks standing in for the server until it is ready.

---

## 1. Project overview

**Name:** CTF Competition Management System (working title: *FlagForge*)

**One-liner:** A website where an admin hosts a Capture-The-Flag event, teams register and solve challenges by submitting flags, and a live leaderboard ranks them, with real-CTF mechanics (dynamic scoring, first blood, costed hints, per-team flags, anti-cheat, scoreboard freeze).

**Why it's a good OOP project:** the domain has natural class hierarchies (challenge types, scoring strategies, users), natural events (a solve triggers many reactions), and real design-pattern use cases, not toy examples.

**Primary goals**
1. Demonstrate every major OOP concept in *real, meaningful* code.
2. Deliver a working, good-looking website.
3. Include genuine novelty that other projects won't have.
4. Everyone in the group can explain every part of the code.

**Non-goals** (to protect scope)
- No real container or VM challenge hosting. Challenges are flag-based with static files and text.
- No email verification, no OAuth, no payments.
- No database server. JSON file persistence is enough.

---

## 2. Requirements

### 2.1 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Player can register, log in and log out | Must |
| FR-02 | Player can create a team (becomes captain), join with an invite code, or leave | Must |
| FR-03 | Team size limit (default 4). Only the captain can kick members or regenerate the invite code | Must |
| FR-04 | Admin can create, edit, hide or unhide, and delete challenges (title, description, category, difficulty, base points, flag, hints, files or links) | Must |
| FR-05 | Player sees the challenge board, filtered by category and difficulty, with solved status per team | Must |
| FR-06 | A team member submits a flag. Result is `CORRECT`, `WRONG`, `ALREADY_SOLVED`, `LOCKED`, `COOLDOWN` or `CLOSED` | Must |
| FR-07 | Points are awarded once per team per challenge | Must |
| FR-08 | Live leaderboard with ranking, tie-break by earliest last scoring solve | Must |
| FR-09 | Admin controls the event: start, pause, resume, end, set the freeze time | Must |
| FR-10 | **Dynamic scoring:** points decay as more teams solve a challenge | Must (novelty) |
| FR-11 | **First blood:** first team to solve gets a bonus and a badge | Must (novelty) |
| FR-12 | **Costed hints:** unlocking a hint deducts points from the team | Must (novelty) |
| FR-13 | **Per-team dynamic flags:** flag is generated per team by HMAC. Reusing another team's flag is detected as flag sharing | Must (novelty) |
| FR-14 | **Observer-driven live feed:** solves, first bloods and events appear in an activity feed automatically | Must (novelty) |
| FR-15 | **Scoreboard freeze:** public board freezes before the end, admin board stays live | Must (novelty) |
| FR-16 | **Anti-cheat:** wrong-attempt cooldown, flag-sharing alerts, admin alert panel | Should |
| FR-17 | **Challenge dependency tree:** a challenge unlocks only after a prerequisite is solved | Should |
| FR-18 | **Score timeline chart:** each team's score over time, drawn as a graph | Should |
| FR-19 | Data persists across server restarts (JSON files) | Must |
| FR-20 | Admin can view all submissions with filters | Should |
| FR-21 | Team profile page: members, solves, score history, badges | Should |
| FR-22 | Admin announcements shown live as banners and in a notification bell | Should |
| FR-23 | Player profile with generated avatar, bio, badges and solve history | Should |
| FR-24 | Challenge attachments (file downloads) with size and name | Should |
| FR-25 | **Hacker-terminal theme with user-changeable colors:** presets, custom accent, effect toggles, persisted per user | Must (novelty) |

### 2.2 Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Language: **C++17**, built with **CMake**. Must compile on GCC, Clang and MSVC |
| NFR-02 | No raw `new` or `delete`. Use smart pointers and RAII |
| NFR-03 | Core library has **no I/O** (no `cout`, no file access, no HTTP). It takes data in and returns data or throws |
| NFR-04 | Server is **thread-safe**: one `std::mutex` (or `shared_mutex`) protects `CTFManager` |
| NFR-05 | Flags are **never** stored or sent in plain text to players. Store hashes, and never return flags from any player-facing API |
| NFR-06 | Passwords stored as salted hashes |
| NFR-07 | All user input validated. Errors surface as typed custom exceptions mapped to HTTP status codes |
| NFR-08 | Frontend escapes all user-supplied text (no XSS) |
| NFR-09 | Unit test coverage on all core classes. Every bug fix gets a regression test |
| NFR-10 | Backend builds and runs with three commands (configure, build, run). Frontend with `npm ci && npm run build`. A `scripts/build-all` helper does both |
| NFR-11 | Frontend is **React 18 + TypeScript (strict) built with Vite**. Dev: Vite server proxies `/api` to the C++ server. Production: `frontend/dist` is served by `ctf_server`, so the demo is still one process |
| NFR-12 | Responsive UI tested at 360, 768, 1280 and 1920 px |
| NFR-13 | Accessibility WCAG AA (contrast, keyboard, focus, reduced motion). Lighthouse ≥ 90 for performance and accessibility on `/challenges` and `/scoreboard` |
| NFR-14 | Realistic look and feel: passes the checklist in section 8.5 |

### 2.3 Actors and use cases

- **Guest:** view landing page and public (possibly frozen) leaderboard, register, log in.
- **Player:** everything a guest can, plus join or create a team, view challenges, submit flags, unlock hints.
- **Captain:** a player who can also manage the team.
- **Admin:** manage challenges, control the event, view live board, submissions and alerts.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser: React 18 + TypeScript SPA (built with Vite)        │
└───────────────────────────────┬─────────────────────────────┘
                                │  HTTP + JSON  (cookie session)
┌───────────────────────────────▼─────────────────────────────┐
│  Server layer   (ctf::server)   cpp-httplib                  │
│   routes, auth middleware, JSON <-> DTO, error mapping       │
│   also serves frontend/dist (built React app)                │
└───────────────────────────────┬─────────────────────────────┘
                                │  calls
┌───────────────────────────────▼─────────────────────────────┐
│  Application layer  CTFManager  (facade + mutex)             │
└───────┬───────────────┬──────────────────┬──────────────────┘
        │               │                  │
┌───────▼──────┐ ┌──────▼───────┐ ┌────────▼─────────┐
│ ctf::core    │ │ ctf::scoring │ │ ctf::events      │
│ User, Player │ │ Strategies   │ │ EventBus,        │
│ Admin, Team  │ │ Scoreboard   │ │ Observers,       │
│ Challenge*   │ │              │ │ AntiCheatMonitor │
│ Submission   │ │              │ │                  │
└───────┬──────┘ └──────────────┘ └──────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────┐
│  ctf::persistence   Repository<T>, JSON save/load            │
└──────────────────────────────────────────────────────────────┘
```

**Rules of the architecture**
1. Dependencies point downward only. Core never includes server headers.
2. The server layer contains **no game rules**. It parses a request, calls `CTFManager`, and formats the answer.
3. Production: one binary, `ctf_server`, serves the API (`/api/...`) and the built React app (`/`). Development: Vite dev server on :5173 proxies `/api` to :8080.
4. The React app holds **no game rules**. It never computes ranks, points or flag validity. The server is the single source of truth.

### 3.1 Tech stack

| Purpose | Choice | Notes |
|---|---|---|
| Language / build | C++17, CMake ≥ 3.16 | Use `FetchContent` for dependencies so no manual installs |
| HTTP server | `cpp-httplib` (header-only) | On Windows link `ws2_32` |
| JSON | `nlohmann/json` | |
| Hashing | `picosha2` (SHA-256), HMAC implemented on top of it (small `crypto` helper, well tested) | |
| Tests | `Catch2` v3 | |
| Frontend framework | React 18 + TypeScript (strict), Vite, React Router v6 | Node 20 LTS needed for the frontend only |
| Frontend UI | Tailwind CSS + shadcn/ui (Radix), lucide-react, Framer Motion, sonner | Accessible, polished components |
| Frontend data | TanStack Query, react-hook-form + zod, native `EventSource` (SSE) | Server is the single source of truth |
| Frontend extras | Recharts, react-markdown + rehype-sanitize + rehype-highlight, canvas-confetti, cmdk, date-fns | Charts, safe markdown, confetti, command palette |
| Frontend testing | Vitest, React Testing Library, MSW, Playwright, axe | Unit, component, E2E, accessibility |
| Diagrams | Mermaid in Markdown (renders on GitHub) | |

### 3.2 Concurrency model
`httplib::Server` handles requests on a thread pool. `CTFManager` owns a `std::shared_mutex`: read endpoints take a shared lock, mutating endpoints take a unique lock. No other class needs its own lock, and this is documented in `CLAUDE.md`.

---

## 4. `CLAUDE.md` (copy this into the repo root as-is)

````markdown
# CLAUDE.md — CTF Competition Management System

## What this project is
A web-based CTF platform. C++17 backend (core library + REST server) and a React + TypeScript frontend (Vite).
Full spec is in docs/PLAYBOOK.md. Read the relevant section before starting any task.

## Hard rules
1. C++17 only. Build with CMake. Must compile with GCC, Clang, MSVC with warnings on (-Wall -Wextra -Wpedantic / /W4).
2. NO raw new/delete. Use std::unique_ptr / std::shared_ptr / containers. RAII everywhere.
3. `ctf::core`, `ctf::scoring`, `ctf::events` contain NO I/O: no iostream output, no file access, no HTTP, no threads.
4. Server layer (`ctf::server`) contains NO game rules. It only parses requests, calls CTFManager, formats responses.
5. Plain-text flags are never stored, logged, or returned by any player API. Store SHA-256 hashes only.
6. Every class gets unit tests in tests/ (Catch2). Run the full test suite before saying a task is done.
7. Use `enum class`, `const` correctness, `override`, `final` where appropriate. Base classes have virtual destructors.
8. Errors use custom exceptions deriving from `ctf::CtfException` (which derives from std::exception). Never return magic error codes.
9. Do not add a new third-party dependency without asking.
10. Do not commit build output, secrets, or data/*.json runtime files.

## Layout
include/ctf/{core,scoring,events,persistence,server}/   headers
src/{core,scoring,events,persistence,server}/           implementations
frontend/                                               React + TypeScript app (src/, e2e/); build output in frontend/dist
tests/                                                  Catch2 tests
data/seed/                                              sample CTF (committed); data/runtime/ is git-ignored
docs/                                                   PLAYBOOK.md, UML, report

## Build & run
  cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
  cmake --build build -j
  ctest --test-dir build --output-on-failure
  ./build/ctf_server --port 8080 --data data/runtime --web frontend/dist
  # frontend (Node 20 LTS)
  cd frontend && npm ci
  npm run dev          # Vite on :5173, proxies /api to :8080
  npm run build        # writes frontend/dist, served by ctf_server
  npm run lint && npm run typecheck && npm run test

## Workflow expectations
- For any non-trivial task: first state a short plan, then implement in small steps.
- After each step: build, run tests, fix failures. Do not leave the tree broken.
- Keep commits small, with messages like `feat(core): add Team with capacity check`.
- If a requirement is ambiguous, ask instead of guessing.
- When finished, summarize: what changed, what tests were added, what is left.

## Frontend rules
1. React 18 + TypeScript (strict), Vite, Tailwind + shadcn/ui. Use only the libraries listed in docs/PLAYBOOK.md section 8.2. Ask before adding another.
2. No game rules on the client: never compute ranks, scores or flag validity. The server is the source of truth.
3. docs/api.md is the API contract. Types and zod schemas live in frontend/src/api/ and mirror it. Parse every response.
4. Every data view implements loading (skeleton), empty and error states.
5. No dangerouslySetInnerHTML except sanitized markdown. No tokens in localStorage. Never persist a submitted flag.
6. Accessible (Radix primitives, labels, visible focus, reduced motion) and responsive (360 / 768 / 1280 px).
7. `npm run lint && npm run typecheck && npm run test` must pass before a task is done.
8. Realism bar: follow docs/PLAYBOOK.md section 8.5. No lorem ipsum, no placeholder text, no default-looking components.
9. Theming: NEVER hardcode colors, shadows or glows. Use theme tokens (CSS variables / Tailwind token classes) only. Every component must look right in ALL presets, including the light "Paper" preset. Glow, scanlines and animations must switch off with the effects toggle and with prefers-reduced-motion. Never rely on color alone to convey meaning.

## OOP showcase checklist (must be visibly present in real code)
Encapsulation, abstraction, inheritance, polymorphism (virtual dispatch), composition/aggregation,
interfaces (pure abstract classes), operator overloading, templates (Repository<T>), friend function,
static members, custom exceptions, smart pointers/RAII, Rule of Five where a class owns resources,
STL algorithms + lambdas, enum class, namespaces.
Design patterns: Strategy (scoring), Observer (events), Factory (challenges), Facade (CTFManager).

## Naming
Classes PascalCase; methods camelCase; members trailing underscore (`score_`); constants kPascalCase; files match class names.
````

---

## 5. Class design

### 5.1 Class catalogue

| Class / type | Namespace | Kind | Responsibility |
|---|---|---|---|
| `CtfException` and subclasses | `ctf` | exceptions | `InvalidFlagFormatException`, `TeamFullException`, `CompetitionClosedException`, `DuplicateSolveException`, `ChallengeLockedException`, `CooldownException`, `AuthException`, `NotFoundException`, `ValidationException`, `PermissionException` |
| `User` | core | **abstract** | id, username, email, bio, avatarSeed, themePrefs, salted password hash, `virtual Role role() const = 0` |
| `Player : User` | core | concrete | team id, personal solve count |
| `Admin : User` | core | concrete | admin-only capabilities flag |
| `Team` | core | concrete | members (`Player` ids), captain, invite code, solved list, hint unlocks, badges; `operator<` |
| `Hint` | core | value class | text, cost |
| `Challenge` | core | **abstract** | id, title, category, difficulty, base points, prerequisites, hints, `virtual bool checkFlag(...) const = 0` |
| `StaticChallenge : Challenge` | core | concrete | one fixed flag (hash) |
| `DynamicFlagChallenge : Challenge` | core | concrete | per-team flag via HMAC |
| `MultiFlagChallenge : Challenge` | core | concrete | N flags, partial credit (stretch) |
| `ChallengeFactory` | core | factory | builds the right subclass from a spec |
| `Submission` | core | value class | team, player, challenge, timestamp, result |
| `Announcement` | core | value class | id, title, body, severity, timestamp |
| `IScoringStrategy` | scoring | **interface** | `virtual int pointsFor(const ScoringContext&) const = 0` |
| `StaticScoring`, `DecayScoring`, `FirstBloodScoring` | scoring | strategies | Strategy pattern. `FirstBloodScoring` is a decorator wrapping another strategy |
| `Scoreboard` | scoring | concrete | computes ranking, tie-break, freeze snapshot, timeline |
| `IEventObserver` | events | **interface** | `virtual void onEvent(const Event&) = 0` |
| `EventBus` | events | subject | subscribe and publish |
| `ActivityFeed`, `EventLog`, `AntiCheatMonitor` | events | observers | feed for UI, audit trail, cheat detection |
| `Repository<T>` | persistence | **template** | generic keyed store with save and load hooks |
| `JsonStore` | persistence | concrete | atomic write (temp file then rename) |
| `SessionManager` | server | concrete | token to user id, expiry |
| `CTFManager` | app | **facade** | the only class the server talks to; owns everything, holds the mutex |
| `ApiRouter` | server | concrete | registers routes, JSON mapping, error mapping |

### 5.2 OOP concept → exact place it is used (the evaluator table)

| OOP concept | Where |
|---|---|
| **Encapsulation** | `Team::score_` private, changed only through controlled methods. Flag hash private inside `Challenge`. Password hash private inside `User` |
| **Abstraction** | Abstract `User`, `Challenge`. Interfaces `IScoringStrategy`, `IEventObserver` |
| **Inheritance** | `Player`, `Admin` from `User`. Three challenge types from `Challenge`. `CtfException` hierarchy |
| **Polymorphism (runtime)** | `challenge->checkFlag(team, input)`, `strategy->pointsFor(ctx)`, `observer->onEvent(e)` via `unique_ptr` / `shared_ptr` to base |
| **Polymorphism (compile-time)** | `Repository<T>` template, function templates in `crypto` helpers |
| **Composition / aggregation** | `Challenge` owns `Hint`s (composition). `Team` references `Player`s (aggregation). `CTFManager` owns everything |
| **Operator overloading** | `Team::operator<` (ranking), `operator<<` for debug printing (friend), `operator==` on `Submission`, `Team::operator+=` for adding score entries |
| **Templates** | `Repository<T>`, generic `filterBy(predicate)` helper |
| **Friend function** | `operator<<(std::ostream&, const Team&)`, JSON serializers as friends where they need private access |
| **Static members** | `Challenge::nextId_`, `Submission::totalCount_`, `Team::kMaxSize` |
| **Exception handling** | Custom hierarchy, thrown by core, mapped to HTTP codes by `ApiRouter` |
| **RAII / smart pointers** | Everywhere. `unique_ptr<Challenge>`, scoped locks, atomic file write helper |
| **Rule of Five / move semantics** | `JsonStore` (owns a file path and buffer), `SessionManager`; documented with `= default` / `= delete` choices |
| **STL + lambdas** | `std::sort` with lambda comparators, `std::accumulate` for score, `std::find_if`, `std::unordered_map` |
| **Design patterns** | Strategy, Observer, Factory, Facade (plus Decorator for `FirstBloodScoring`) |
| **Namespaces, `enum class`, `const` correctness** | Throughout |

---

## 6. Novelty features: exact specs

### 6.1 Dynamic scoring (Strategy)
CTFd-style parabolic decay:
```
points(solves) = max( minPoints,
                      ceil( ((minPoints - initial) / decay^2) * solves^2 + initial ) )
```
- `initial` = challenge base points, `minPoints` = 20% of initial (configurable), `decay` = number of solves at which it reaches the minimum (default 10).
- **Scores are derived, not stored.** A team's score = sum of *current* value of each solved challenge + first-blood bonuses − hint costs. So when a challenge decays, everyone who solved it drops equally (this is the real-CTF behavior). `Scoreboard` recomputes on demand.
- Implemented as `DecayScoring : IScoringStrategy`. Each challenge holds a `unique_ptr<IScoringStrategy>`, so two challenges can score differently.

### 6.2 First blood (Decorator on Strategy)
- `FirstBloodScoring` wraps another strategy and adds `+10%` of the challenge's initial points for the first solver only.
- The team also gets a `FIRST_BLOOD` badge and an event is published.

### 6.3 Costed hints
- Each hint has a `cost`. Unlocking deducts it from the team score (it's a recorded `HintUnlock`, so it's part of the derived score).
- Idempotent per team: unlocking twice charges once. The hint text is returned only after unlocking. Hint text is never in the challenge list response.

### 6.4 Per-team dynamic flags + flag-sharing detection
- For `DynamicFlagChallenge`, the correct flag for team T on challenge C is
  `CTF{ + hex(HMAC_SHA256(serverSecret, C.id + ":" + T.id))[0..24] + }`
- The admin sets a **flag prefix/template** only. Players get their own flag by solving (in the seed CTF, "solving" means the challenge description tells them how to derive/find it. For the demo, an admin-only "reveal team flag" endpoint simulates a team obtaining it).
- **Detection:** when a submission on challenge C from team A doesn't match A's flag, the system checks whether it matches **any other team's** flag for C. If yes → `FLAG_SHARING` alert naming both teams. Submission is rejected and logged.
- `serverSecret` comes from a file or environment variable at start-up, never hardcoded.

### 6.5 Observer-driven events
Event types: `SOLVE`, `FIRST_BLOOD`, `WRONG_ATTEMPT`, `HINT_UNLOCKED`, `TEAM_CREATED`, `TEAM_JOINED`, `EVENT_STARTED`, `EVENT_PAUSED`, `EVENT_ENDED`, `FLAG_SHARING`, `COOLDOWN_TRIGGERED`, `ANNOUNCEMENT`.
Observers subscribed at startup: `ActivityFeed` (public-safe messages, ring buffer of 200), `EventLog` (full audit, persisted), `AntiCheatMonitor` (produces alerts). Adding a new observer must require **zero changes** to `CTFManager` submission logic (mention this in the report).

### 6.6 Scoreboard freeze
- Admin sets `freezeAt`. After that time the public `GET /api/scoreboard` returns the **snapshot taken at freezeAt**. `GET /api/admin/scoreboard` stays live.
- Frontend shows a "❄ Scoreboard frozen" banner. When the event ends, admin can "unfreeze and reveal".

### 6.7 Anti-cheat and rate limiting
- After 5 wrong attempts on the same challenge within 60 seconds, the team is on a 30 second cooldown for that challenge (`COOLDOWN` result).
- Alerts: `FLAG_SHARING`, `BURST_SUBMISSIONS` (>20 submissions per minute from one team), `SAME_WRONG_FLAG_MULTI_TEAM` (identical wrong flag from 3+ teams).
- Admin alert panel lists alerts with status `OPEN` or `DISMISSED`.

### 6.8 Challenge dependency tree
- `Challenge` has `prerequisites: vector<ChallengeId>`. A challenge is `LOCKED` for a team until all prerequisites are solved by that team.
- Validate on creation: no cycles (DFS check), unknown ids rejected.
- The frontend can draw this as a small graph (stretch).

### 6.9 Score timeline
- `Scoreboard::timeline(topN)` returns, for each team, a list of `(timestamp, cumulativeScore)` points, replaying solves in time order using the scoring strategies. Frontend renders it with Recharts.

**Scope guard:** if time runs short, drop in this order: multi-flag challenge → dependency graph drawing → timeline chart → burst/same-wrong-flag alerts. **Never drop:** dynamic scoring, first blood, hints, per-team flags, observers, freeze.

---

## 7. REST API specification

**Envelope:** every response is JSON.
Success: `{ "ok": true, "data": ... }`
Failure: `{ "ok": false, "error": { "code": "TEAM_FULL", "message": "..." } }`

**Auth:** cookie `session=<token>` (HttpOnly, SameSite=Strict). Middleware attaches the user; admin routes require `Role::Admin`.

**Error → HTTP mapping**

| Exception | HTTP | code |
|---|---|---|
| `ValidationException` | 400 | `VALIDATION` |
| `AuthException` | 401 | `UNAUTHENTICATED` |
| `PermissionException` | 403 | `FORBIDDEN` |
| `NotFoundException` | 404 | `NOT_FOUND` |
| `DuplicateSolveException`, `TeamFullException` | 409 | `CONFLICT` / `TEAM_FULL` |
| `ChallengeLockedException` | 423 | `LOCKED` |
| `CooldownException` | 429 | `COOLDOWN` |
| `CompetitionClosedException` | 403 | `CLOSED` |
| anything else | 500 | `INTERNAL` (no stack trace leaked) |

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/register` | none | `{username,email,password}` |
| `POST /api/auth/login` | none | sets cookie |
| `POST /api/auth/logout` | user | |
| `GET /api/auth/me` | user | current user + team + `themePrefs` |
| `POST /api/teams` | user | create team `{name}` |
| `POST /api/teams/join` | user | `{inviteCode}` |
| `POST /api/teams/leave` | user | |
| `GET /api/teams/me` | user | my team details |
| `GET /api/teams/:id` | none | public team profile |
| `POST /api/teams/me/kick` | captain | `{playerId}` |
| `POST /api/teams/me/invite/regenerate` | captain | |
| `GET /api/event/status` | none | state, start, end, freezeAt, serverTime |
| `GET /api/challenges` | user | list (no flags, no hint text), per-team state: `solved`, `locked`, `currentPoints`, `solveCount` |
| `GET /api/challenges/:id` | user | detail: markdown description, unlocked hints only, attachments, prerequisite titles, recent solvers, scoring params (initial, min, decay) |
| `GET /api/challenges/:id/files/:name` | user | download an attachment (event must be running) |
| `POST /api/challenges/:id/submit` | user (in team) | `{flag}` → result |
| `POST /api/challenges/:id/hints/:hintId/unlock` | user (in team) | returns hint text, new score |
| `GET /api/scoreboard` | none | public (respects freeze): rank, score, solves, lastSolveAt, per-category solve counts, rank delta |
| `GET /api/scoreboard/timeline?top=10` | none | timeline data |
| `GET /api/feed?since=<id>` | none | activity feed |
| `GET /api/events/stream` | none | Server-Sent Events: `feed`, `scoreboard`, `event-status`, `announcement` messages, heartbeat every 15 s |
| `GET /api/announcements` | none | announcements, newest first |
| `GET /api/users/:id` | none | public player profile: team, solves, badges |
| `PATCH /api/users/me` | user | update bio, avatar seed and `themePrefs` (opaque JSON string, max 2 KB, validated, never rendered as HTML) |
| `POST /api/admin/challenges` | admin | create |
| `PUT /api/admin/challenges/:id` | admin | edit |
| `DELETE /api/admin/challenges/:id` | admin | delete |
| `POST /api/admin/challenges/:id/visibility` | admin | `{visible}` |
| `POST /api/admin/event/{start,pause,resume,end}` | admin | |
| `POST /api/admin/event/freeze` | admin | `{freezeAt}` |
| `GET /api/admin/scoreboard` | admin | always live |
| `GET /api/admin/submissions?team=&challenge=&result=` | admin | filterable |
| `GET /api/admin/alerts` | admin | anti-cheat alerts |
| `POST /api/admin/alerts/:id/dismiss` | admin | |
| `POST /api/admin/announcements` | admin | `{title, body, severity}` |
| `GET /api/admin/teams/:teamId/flag/:challengeId` | admin | reveal a team's dynamic flag (demo and testing) |

The first registered user, or a user created by the seed script with the admin role, is the admin. Document how in the README.

---

## 8. Frontend specification (React + TypeScript)

### 8.1 The bar: "this looks like a real platform"
Aim for **CTFd's functionality** with **Hack The Box / TryHackMe polish** and **Linear / Vercel-level UI cleanliness**. An evaluator opening the site should think it is a real product, not a college assignment. Do not copy anyone's logo, brand assets or exact layout. Design the platform's own identity (name, logo mark, colors). The visual identity is a **hacker terminal** that the user can re-color (section 8.4).

### 8.2 Stack (only these; ask before adding more)

| Concern | Library |
|---|---|
| Framework / build | React 18, TypeScript (strict), Vite |
| Routing | React Router v6 (lazy routes, per-route error boundaries) |
| Server state | TanStack Query v5 (caching, polling, invalidation) |
| Forms / validation | react-hook-form + zod |
| Styling / components | Tailwind CSS + shadcn/ui (Radix primitives), lucide-react icons |
| Motion | Framer Motion (layout animations for rank changes), canvas-confetti |
| Feedback | sonner (toasts) |
| Charts | Recharts (timeline, radar, decay curve) |
| Tables | TanStack Table (admin) |
| Content | react-markdown + rehype-sanitize + rehype-highlight |
| Command palette | cmdk (shadcn `Command`) |
| Dates | date-fns |
| Fonts | JetBrains Mono (default), Fira Code, IBM Plex Mono (user-selectable) and Inter (optional "readable text" mode), all self-hosted with `@fontsource` (no CDN) |
| Testing | Vitest, React Testing Library, MSW (also used as the dev mock server), Playwright, axe |
| Quality | ESLint, Prettier, `tsc --noEmit` |

### 8.3 Folder structure
```
frontend/
├── src/
│   ├── app/            router, providers, layouts, error boundaries
│   ├── api/            client.ts, types.ts, zod schemas, query keys, one hook per endpoint
│   ├── components/
│   │   ├── ui/         shadcn primitives
│   │   └── ...         domain components (ChallengeCard, FlagInput, ScoreTable, TeamAvatar, Countdown...)
│   ├── features/       auth, challenges, scoreboard, team, profile, feed, notifications, admin
│   ├── hooks/          useEventStream, useServerTime, useCountdown, useCommandPalette...
│   ├── theme/          ThemeProvider, useTheme, presets.ts, color + contrast utils, ThemeCustomizer, no-flash script
│   ├── lib/            format, constants, cn()
│   ├── mocks/          MSW handlers + realistic fixtures (toggle with VITE_USE_MOCKS=true)
│   └── styles/         globals.css (design tokens)
├── e2e/                Playwright tests
└── vite.config.ts      dev proxy: /api -> http://localhost:8080
```

### 8.4 Design system: "Hacker terminal", fully themeable

**Identity.** A terminal from a hacker film crossed with a modern developer tool: near-black, monospace-first, glowing accent. It must stay *readable and product-grade*. The layout is clean and the terminal feel comes from details, not from making text hard to read.

**Signature elements**
- **Monospace-first type:** JetBrains Mono for chrome, headings, tables, numbers, flags and code. An optional "Readable text" switch sets long-form content (challenge descriptions, rules, announcements) in Inter.
- **Terminal windows:** cards, dialogs and panels have a slim title bar (three window dots + a path title such as `~/challenges/web/inspect-me`), a 1 px accent-tinted border and square-ish radii (2 / 4 / 8 px).
- **Prompt-style headings:** `$ ls challenges`, `root@flagforge:~/scoreboard#`, with a blinking block cursor on the active heading or input.
- **Effects (each individually toggleable):** phosphor glow (text and box shadows from the accent), scanlines overlay (very low opacity, `pointer-events: none`), soft CRT vignette, cursor blink, typewriter reveals, glitch on logo hover, a **boot sequence** on first visit per session.
- **Logo:** ASCII-art wordmark (hero and boot screen) and a compact SVG `>_` flag glyph (navbar), both created in-repo.
- **Terminal semantics:** status shown as `[ OK ]`, `[FAIL]`, `[+]`, `[!]`, `[-]`. Errors look like stderr (`permission denied`, `bash: /page: command not found`). Difficulty shows as `[■□□]` `[■■□]` `[■■■]` plus color.
- **Avatars:** deterministic pixel identicons (5×5 symmetrical grid from a hash of the name), drawn in the current accent. No external avatar service.
- **Icons:** lucide-react, with occasional ASCII glyphs. One icon per category and per event type.

**Theme architecture**
- All colors are CSS variables on `:root`, switched by `data-theme="<preset>"` on `<html>`. A custom accent sets `--accent-h`, `--accent-s`, `--accent-l` inline and every other accent token is **derived** from those three. Components use token classes only (Tailwind config maps utilities to the variables), so a re-color needs no component changes.
- **Token set:** `--bg`, `--panel`, `--overlay`, `--border`, `--border-strong`, `--fg`, `--fg-muted`, `--accent`, `--accent-fg` (text on accent), `--accent-dim`, `--accent-glow`, `--selection`, `--focus-ring`, `--success`, `--warning`, `--danger`, `--info`, `--cat-web`, `--cat-crypto`, `--cat-forensics`, `--cat-reverse`, `--cat-pwn`, `--cat-misc`, `--chart-1` … `--chart-8`.
- **Derivation from one accent:** `--accent-dim` = accent at −25% lightness, `--accent-glow` = accent at 35% alpha, `--border` = accent at ~18% mixed into `--bg`, `--fg-muted` = fg at 65%, backgrounds tinted with the accent hue at very low saturation.
- **Runtime consumers:** charts (Recharts), confetti, toasts and the boot screen read tokens with `getComputedStyle` and update live on theme change.
- **No flash of the wrong theme:** a tiny inline script in `index.html` reads saved preferences and sets `data-theme` and CSS variables before first paint.

**Presets** (default is Matrix Green)

| Preset | Background | Foreground | Accent | Notes |
|---|---|---|---|---|
| **Matrix Green** (default) | `#070b08` | `#c9f7d8` | `#00ff88` | Classic phosphor green, full effects |
| **Cyber Cyan** | `#060b10` | `#d0f4ff` | `#00e5ff` | Cool blue-cyan |
| **Amber CRT** | `#0d0a04` | `#ffe2a8` | `#ffb000` | Old amber monitor, strong glow |
| **Synthwave** | `#0d0714` | `#f3d9ff` | `#ff2bd6` | Secondary accent `#00e5ff` |
| **Blood Red** | `#0d0505` | `#ffd6d6` | `#ff3b3b` | Red-team look |
| **Ghost Mono** | `#0a0a0a` | `#d4d4d4` | `#e6e6e6` | Grayscale. Categories differ by icon, label and pattern |
| **Paper** (light) | `#f4f1e8` | `#1a1a1a` | `#0a7a3d` | Light "e-ink terminal", no glow, no scanlines |
| **Custom** | Pure black / Tinted dark / Deep navy | derived | user's color | See below |

**Theme customizer** (a palette button in the navbar, and "Theme: ..." commands in the command palette; opens as a side sheet with a **live preview**)
- Preset picker (visual swatch cards, applies instantly, no reload).
- **Custom accent:** color picker + hex input + hue slider. Also a background style: Pure black / Tinted dark / Deep navy.
- **Effects:** master switch ("Reduce effects"), glow intensity slider (0-100), scanlines, CRT vignette, cursor blink and animations, boot sequence on/off.
- **Typography and density:** font family (JetBrains Mono / Fira Code / IBM Plex Mono), font size (S / M / L), density (Compact / Comfortable), "Readable text" (Inter for long-form).
- **Reset to default**, plus **export / import** of a theme as a short JSON string, so teammates can share themes.

**Accessibility guard**
- A contrast utility (WCAG relative luminance) checks a custom theme: text on background ≥ 4.5:1, accent used as text ≥ 4.5:1, `--accent-fg` on accent ≥ 4.5:1, non-text UI (borders, focus ring) ≥ 3:1.
- If a custom color fails, the customizer auto-adjusts lightness in small steps and shows "Adjusted for readability". Never silently save an unreadable theme.
- `prefers-reduced-motion` and `prefers-contrast: more` turn effects down by default. Meaning is never conveyed by color alone (icon + label + pattern).

**Persistence:** `localStorage` key `ctf.theme.v1` holds `{preset, accent, bgStyle, effects:{master, glow, scanlines, vignette, motion, boot}, font, size, density, readable}`. Theme preferences are not sensitive, so this does not conflict with the "no tokens in localStorage" rule. For logged-in users, preferences also sync to the server through `PATCH /api/users/me` (`themePrefs`), so the theme follows them across devices (stretch goal). The server only stores the string and never interprets it.

**Other design rules**
- 4 px spacing grid, 1200 px max content width, subtle borders instead of heavy shadows (glow replaces shadows in dark presets).
- Type scale 12 / 14 / 16 / 20 / 24 / 32 / 48. Motion 120-200 ms, `steps()` timing for typewriter effects, meaningful motion only.
- Category hues are fixed and tuned per preset for contrast: Web = blue, Crypto = violet, Forensics = amber, Reverse = red, Pwn = pink, Misc = slate. They are separate from the accent, so recoloring never makes categories indistinguishable.

### 8.5 Realism checklist (ID each item in `docs/ui-audit.md`)

**States and resilience**
- [ ] R-01 Skeleton loaders shaped like the real content (cards, table rows, chart) on every data view
- [ ] R-02 Designed empty states with a message and a call to action (no team yet, no solves yet, no alerts)
- [ ] R-03 Per-route error boundary with a retry button, and a friendly 404 and 403 page
- [ ] R-04 Session expiry redirects to login and returns the user to where they were (`returnTo`)
- [ ] R-05 Offline banner, and mutations disabled while offline
- [ ] R-06 Buttons show pending state and are disabled during requests (no double submit)

**Real-time behavior**
- [ ] R-07 Live updates over SSE with automatic reconnect and polling fallback
- [ ] R-08 Scoreboard rows animate to their new position when ranks change, with rank delta arrows
- [ ] R-09 Countdown uses server-time offset, so it stays correct if the client clock is wrong
- [ ] R-10 Event state banner: Not started / Live / Paused / Frozen / Ended, with matching UI locks
- [ ] R-11 First-blood and solve toasts appear for everyone in near real time

**Challenge experience**
- [ ] R-12 Challenge dialog is deep-linkable (`/challenges/:id`) and closes with Esc
- [ ] R-13 Markdown descriptions with code highlighting, sanitized
- [ ] R-14 Attachments shown as file cards (name, size, download button)
- [ ] R-15 Flag input is monospace, has a `CTF{...}` placeholder, trims whitespace and supports paste
- [ ] R-16 Wrong flag: shake, message, remaining attempts before cooldown. Cooldown: live countdown on the button
- [ ] R-17 Correct flag: confetti, animated points award. First blood: special celebration
- [ ] R-18 Hints: cost badge, confirmation step, reveal animation, remaining balance shown
- [ ] R-19 Locked challenges show which prerequisites are missing
- [ ] R-20 Points badge shows decay (initial → current → minimum) with a small curve tooltip

**Scoreboard and profiles**
- [ ] R-21 Rank medals for top 3, avatars, monospace scores, solved-per-category dots
- [ ] R-22 "My team" row highlighted, with a jump-to-me button and a search box
- [ ] R-23 Timeline chart of top teams with hover tooltip, legend toggles and range selector
- [ ] R-24 Frozen banner showing the snapshot time
- [ ] R-25 Team and player profiles with badges, solve timeline and category radar chart

**Navigation and delight**
- [ ] R-26 Sticky top bar with event status pill and countdown, user menu, palette button that opens the theme customizer
- [ ] R-27 Command palette (Ctrl/Cmd + K) to jump to pages, challenges and teams
- [ ] R-28 Notification bell with unread count (announcements and personal events)
- [ ] R-29 Announcement banner with severity styling and dismiss
- [ ] R-30 Landing page hero with animated terminal typing effect and live stats
- [ ] R-31 Copy buttons (invite code, flags shown to admin) with "Copied" feedback

**Admin**
- [ ] R-32 Sortable, filterable, paginated tables with column visibility and CSV export
- [ ] R-33 Challenge editor with live markdown preview and live decay-curve preview
- [ ] R-34 Prerequisite picker warns about cycles before saving
- [ ] R-35 Event controls with confirmation. Ending requires typing `END`
- [ ] R-36 Alerts panel with severity badges, evidence drawer and dismiss

**Quality**
- [ ] R-37 No lorem ipsum or placeholder copy anywhere. Microcopy is written like a product
- [ ] R-38 Responsive at 360 / 768 / 1280 / 1920 px. Tables collapse to cards on mobile and a bottom nav appears under 768 px
- [ ] R-39 WCAG AA: contrast, labels, visible focus, focus trapping in dialogs, `aria-live` toasts, reduced motion
- [ ] R-40 Lighthouse ≥ 90 (performance and accessibility) on `/challenges` and `/scoreboard` in the production build
- [ ] R-41 Route-level code splitting. No console errors or warnings

**Terminal identity and theming**
- [ ] R-42 Boot sequence on first visit per session (believable system messages, skippable with any key or click, off when effects are reduced)
- [ ] R-43 Terminal-window styling everywhere: title bar with dots and a path title, prompt-style headings, block cursor
- [ ] R-44 Phosphor glow, scanlines, CRT vignette and cursor blink implemented in CSS, each individually toggleable
- [ ] R-45 ASCII wordmark on hero and boot screen, SVG `>_` glyph in the navbar, glitch on logo hover
- [ ] R-46 Theme customizer reachable from the navbar and the command palette. All 7 presets switch instantly with no reload and no flash
- [ ] R-47 Custom accent (picker + hex + hue slider): buttons, borders, glow, focus rings, charts, confetti, identicons and toasts all re-derive from it
- [ ] R-48 Contrast guard: custom colors that fail WCAG AA are auto-adjusted with a visible notice
- [ ] R-49 Controls for glow intensity, scanlines, vignette, animations, boot sequence, font family, font size, density and "Readable text"
- [ ] R-50 Preferences persist across reloads, have a reset button and export/import as a JSON string (server sync via `themePrefs` is a stretch goal)
- [ ] R-51 No flash of the default theme on load (inline pre-hydration script)
- [ ] R-52 Charts, category badges and status indicators stay distinguishable in every preset, including Ghost Mono and Paper (icons, labels or patterns, never color alone)
- [ ] R-53 Terminal microcopy: 404 as `command not found`, errors styled as stderr, `[ OK ]` / `[FAIL]` status tags, a `sudo` easter egg in the command palette

### 8.6 Routes

| Route | Page |
|---|---|
| `/` | Landing (hero, live stats, countdown, top-5, how it works, FAQ) |
| `/login`, `/register` | Auth |
| `/challenges`, `/challenges/:id` | Challenge board and dialog |
| `/scoreboard` | Scoreboard and timeline |
| `/team` | My team |
| `/teams/:id`, `/players/:id` | Public profiles |
| `/feed` | Activity feed (side panel on desktop) |
| `/rules` | Rules and FAQ |
| `/admin/event`, `/admin/challenges`, `/admin/challenges/new`, `/admin/challenges/:id` | Admin |
| `/admin/scoreboard`, `/admin/submissions`, `/admin/alerts`, `/admin/announcements` | Admin |
| `*` | 404 |

### 8.7 API integration rules
- Types and zod schemas mirror `docs/api.md`. **Every response is parsed**, so contract drift fails loudly in development.
- Query-key factory, `refetchInterval` per endpoint as a fallback, invalidate on mutations. Optimistic updates only where safe (never for flag submission or scoring).
- **Mocks first:** the whole UI must run with `VITE_USE_MOCKS=true` (MSW) before the backend exists. Mocks follow `docs/api.md` exactly and use realistic data: 12 teams, 60 players, 10 challenges and several days of believable solves.
- Dev: Vite proxy `/api` to `localhost:8080`. Prod: `npm run build` writes `frontend/dist`, which `ctf_server` serves.
- The only client-side computation allowed is the **display-only** decay-curve preview, computed from server-provided parameters and labeled as a preview.

### 8.8 Definition of done for a UI task
`npm run lint`, `typecheck` and `test` pass · loading, empty and error states exist · checked at 360 / 768 / 1280 px and in at least 3 presets (including Paper) · keyboard-only walkthrough works · no console errors · screenshots attached to the PR · relevant R-items ticked.

---

## 9. Process: phases, owners, and Claude Code prompts

### 9.1 Team roles (4 people; merge if fewer)

| Role | Owns | Branch prefix |
|---|---|---|
| **A: Core Domain lead** | `core/`, `ChallengeFactory`, exceptions | `feat/core-*` |
| **B: Scoring & Events lead** | `scoring/`, `events/`, anti-cheat | `feat/scoring-*` |
| **C: Backend/Platform lead** | `persistence/`, `CTFManager`, `server/`, auth, CMake, CI | `feat/server-*` |
| **D: Frontend lead** | `frontend/` (React app), UX, MSW mocks, demo data | `feat/web-*` |
| **Everyone** | reviewing PRs, tests for own code, report sections, viva readiness | |

If you are 3: merge B into A. If 2: A+B and C+D. If 1: run phases in order and skip stretch items.

### 9.2 Git workflow
- `main` is always green (builds, tests pass). No direct commits to `main`.
- One feature branch per task, small PRs, at least one teammate reviews.
- Commit style: `feat(scope): ...`, `fix(scope): ...`, `test(scope): ...`, `docs: ...`.
- Before starting a Claude Code session: `git pull`. Before ending: build, test, commit, push.

### 9.3 Timeline (relative; stretch or compress to your deadline)

| Phase | Deliverable | Weight of total time |
|---|---|---|
| 0 | Repo bootstrapped, `CLAUDE.md`, CMake, CI | 5% |
| 1 | Design: UML + header-only skeleton, reviewed by the group | 10% |
| 2 | Core domain + tests | 12% |
| 3 | Scoring, scoreboard, events + tests | 12% |
| 4 | Dynamic flags, anti-cheat, dependency tree + tests | 8% |
| 5 | Persistence + `CTFManager` (thread-safe) + tests | 8% |
| 6 | REST server + API tests | 10% |
| 7 | React frontend (prompts 7a-7f) | 25% |
| 8 | Integration, seed CTF, end-to-end run | 5% |
| 9 | Hardening, docs, report, demo rehearsal | 5% |

Phases 2, 3 and 7 run in parallel once Phase 1 (headers + `docs/api.md`) is approved. The frontend does **not** wait for the backend: it is built against MSW mocks and switched to the real server in Phase 8.

### 9.4 Universal rules for every Claude Code session
1. Start by saying: *"Read CLAUDE.md and docs/PLAYBOOK.md sections X."*
2. Ask for a **plan first**, approve it, then implement.
3. One class or one feature per prompt. Never "build everything".
4. After every change: build + run tests. Paste failures back to Claude Code rather than patching by hand blindly.
5. Ask Claude Code to **explain** anything you don't understand. You must be able to defend the code in the viva.
6. End every session with the *Review prompt* (9.6).

---

### 9.5 The prompts

Paste them in order. `<...>` marks things you fill in.

#### PROMPT 0: Bootstrap
```
Read docs/PLAYBOOK.md fully, especially sections 1-5.

Task: bootstrap the repository.
1. Extract the CLAUDE.md block from section 4 into ./CLAUDE.md.
2. Create the folder layout described in CLAUDE.md (with .gitkeep where needed).
3. Create a root CMakeLists.txt (C++17, warnings on) that:
   - uses FetchContent for cpp-httplib, nlohmann/json, picosha2, Catch2 v3
   - builds a static library `ctf_core` (core + scoring + events + persistence),
     an executable `ctf_server`, and a test executable `ctf_tests` registered with ctest
   - links ws2_32 on Windows
4. Add .gitignore (build/, data/runtime/, node_modules/, frontend/dist/, IDE files) and a minimal README with the build/run steps for backend and frontend.
5. Add a placeholder test that passes, and a placeholder main that starts httplib on port 8080 and returns {"ok":true} at GET /api/health.
6. Create frontend/ with a minimal Vite + React + TypeScript scaffold (a page that calls /api/health through the Vite
   proxy) so CI can build it. The full setup happens later in Prompt 7a.
7. Add a GitHub Actions workflow: C++ build + ctest on Ubuntu and Windows, and a Node 20 job running npm ci, lint,
   typecheck, test and build in frontend/.

First show me your plan. After I approve, implement it, build it, run ctest, and confirm /api/health works.
```

#### PROMPT 1: Design and skeleton (no implementations)
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 5, 6 and 7.

Task: produce the design artifacts BEFORE any implementation.
1. Create docs/uml/class-diagram.md with a Mermaid classDiagram covering every class in section 5.1
   (inheritance, composition, aggregation, interfaces, key methods).
2. Create docs/uml/sequence-submit-flag.md: Mermaid sequence diagram for "player submits a flag"
   (browser -> ApiRouter -> CTFManager -> Challenge::checkFlag -> IScoringStrategy -> EventBus -> observers).
3. Create docs/uml/use-cases.md: use-case diagram for Guest, Player, Captain, Admin.
4. Create header-only skeletons in include/ctf/... for ALL classes in 5.1: class declarations, pure virtual
   interfaces, method signatures, doc comments, and exception classes. No method bodies except trivial ones.
   Each header must compile on its own (include what you use).
5. Add docs/uml/oop-mapping.md reproducing the OOP-concept table from section 5.2 with real file/line references
   once they exist (leave TODO markers now).
6. Create docs/api.md: the API CONTRACT from section 7 with a request and response JSON example and all error codes for
   every endpoint (including SSE message formats). The frontend and its MSW mocks are built from this file, so be precise.

Do not implement logic yet. Ensure the project still builds. Summarize the design decisions and any questions
you have for the group.
```

#### PROMPT 2: Core domain (Role A)
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 5 and 6.

Task: implement ctf::core using the approved headers.
- Exceptions hierarchy.
- User (abstract), Player, Admin with salted password hashing via a small crypto helper (SHA-256 + random salt).
- Team: capacity check (kMaxSize static), captain rules, invite code, operator<, friend operator<<, operator+=.
- Hint, Challenge (abstract), StaticChallenge, ChallengeFactory (string/enum -> unique_ptr<Challenge>).
- Submission with static counter and operator==.
- Prerequisite validation with cycle detection (DFS) in a free function or ChallengeGraph helper.

Constraints: no I/O, no raw new/delete, const-correct, virtual destructors, `override` everywhere.

Write Catch2 tests for every class, including failure paths (full team, bad password, cyclic prerequisites,
wrong flag, duplicate solve). Build, run tests, and fix. Then list which OOP concepts from section 5.2 you
implemented in this step, with file names.
```

#### PROMPT 3: Scoring, scoreboard, events (Role B)
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 5 and 6 (6.1, 6.2, 6.3, 6.5, 6.6, 6.9).

Task: implement ctf::scoring and ctf::events.
- IScoringStrategy, StaticScoring, DecayScoring (exact formula in 6.1), FirstBloodScoring as a decorator.
- Scoreboard: derives team scores from solve records + hint unlocks + first-blood bonuses, ranks with the
  tie-break rule (score desc, earliest last-scoring-solve asc, name asc), supports a freeze snapshot,
  and produces timeline(topN).
- EventBus with subscribe/unsubscribe/publish, Event struct with typed enum class EventType.
- Observers: ActivityFeed (ring buffer, public-safe text), EventLog (full audit).

Tests: decay values at solves=0,1,5,10,50; first blood only once; ties; freeze snapshot ignores later solves;
timeline is monotonic non-decreasing except for hint costs; adding a new observer needs no change to publishers.
Build, run tests, and summarize.
```

#### PROMPT 4: Dynamic flags, anti-cheat, cooldown (Roles A+B)
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 6.4, 6.7, 6.8.

Task:
1. Implement HMAC-SHA256 in the crypto helper (test against RFC 4231 vectors).
2. Implement DynamicFlagChallenge: per-team flag derived by HMAC(serverSecret, challengeId + ":" + teamId).
   Provide expectedFlagFor(teamId) for admin/demo only; never expose via player APIs.
3. Implement AntiCheatMonitor (an IEventObserver plus a query interface): FLAG_SHARING detection (submitted flag
   matches another team's flag), BURST_SUBMISSIONS, SAME_WRONG_FLAG_MULTI_TEAM, with alert status OPEN/DISMISSED.
4. Implement the per-team per-challenge cooldown (5 wrong in 60s -> 30s cooldown) as a separate small class,
   injectable clock (interface IClock) so tests don't sleep.

Tests: flag sharing is detected and names both teams; cooldown starts and ends with a fake clock; timing-safe
comparison is used for flag hashes. Build, run tests, summarize.
```

#### PROMPT 5: Persistence and CTFManager (Role C)
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 3.2, 5 and 6.

Task:
1. Implement Repository<T> (template) with add/get/remove/findIf/all and a serializer traits mechanism.
2. Implement JsonStore: atomic save (write temp file, then rename), load on startup, schema version field.
   Follow the Rule of Five explicitly (document = default/delete choices).
3. Implement CTFManager as the facade: register/login, team ops, challenge CRUD, submitFlag, unlockHint,
   event state machine (NotStarted -> Running <-> Paused -> Ended), freeze handling, scoreboard access, announcements, admin queries.
   Guard it with a std::shared_mutex (shared lock for reads, unique lock for writes).
   submitFlag must: check event is running, membership, prerequisites, cooldown, duplicate solve, then check the
   flag polymorphically, publish events, and persist.
4. SessionManager (random 128-bit token, expiry, revoke).

Tests: a full submit-flag scenario matrix (correct, wrong, duplicate, locked, cooldown, closed, first blood),
persistence round trip (save, restart, load, same scoreboard), and a multithreaded stress test (N threads submitting
concurrently produce consistent scores, with no data race).
Build, run tests, summarize.
```

#### PROMPT 6: REST server (Role C)
```
Read CLAUDE.md and docs/PLAYBOOK.md section 7 (API spec) carefully.

Task: implement ctf::server ApiRouter and main().
- Implement every endpoint in the table, with the response envelope and the exception -> HTTP mapping.
- Auth middleware: cookie session (HttpOnly, SameSite=Strict), admin guard, JSON body size limit, content-type checks.
- Serve frontend/dist as static files at "/" (long cache for hashed assets, no-cache for index.html) with SPA fallback to
  index.html for any non-/api route.
- Implement GET /api/events/stream (text/event-stream): heartbeat every 15 s, clean up on client disconnect, publish
  feed/scoreboard/event-status/announcement messages from the EventBus. Size the httplib thread pool for many long-lived streams (>= 64).
- main(): parse --port/--data/--web/--secret-file, load JsonStore, seed if data dir is empty, graceful shutdown.
- No game rules in this layer.

Tests: API tests using an in-process httplib client against the server on an ephemeral port, covering the auth
flow, team flow, submit flow, admin-only route protection (403 for players), and that flags/hint text never
appear in player-facing responses. Also verify every route against the contract in docs/api.md (the React app and its mocks depend on it; flag any deviation) and add a Postman-style
curl examples section. Build, run tests, summarize.
```

#### PROMPT 7a: Frontend foundation and design system (Role D)
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 7 and 8 (all of section 8), and docs/api.md.

Task: build the foundation of the React app in frontend/.
1. Vite + React 18 + TypeScript (strict), ESLint + Prettier, Tailwind CSS, shadcn/ui (Radix) initialised, lucide-react,
   Framer Motion, sonner, TanStack Query, React Router v6, react-hook-form + zod, Recharts, react-markdown +
   rehype-sanitize + rehype-highlight, canvas-confetti, date-fns, cmdk. Self-host JetBrains Mono, Fira Code, IBM Plex Mono and Inter via
   @fontsource (no CDN). Add only what section 8.2 lists.
2. THEME SYSTEM exactly as section 8.4, built FIRST so every later component is developed against several themes:
   - tokens in src/styles/globals.css and the Tailwind token mapping (no hardcoded colors anywhere),
   - src/theme/presets.ts with all 7 presets (Matrix Green default, Cyber Cyan, Amber CRT, Synthwave, Blood Red, Ghost Mono,
     Paper) plus the custom accent with derived tokens,
   - ThemeProvider + useTheme, and color/contrast utilities with unit tests (WCAG ratios, auto-adjust),
   - an inline no-flash script in index.html,
   - the ThemeCustomizer side sheet (presets, custom accent picker + hex + hue slider, background style, effects toggles,
     glow slider, font family, size, density, Readable text, reset, export/import), persisted to localStorage.
   Terminal signature pieces: window-style Panel component (title bar with dots + path), prompt-style headings with a
   blinking cursor, scanline and vignette overlays, glow utilities, ASCII wordmark and the SVG >_ glyph logo, and a product name.
3. App shell: sticky top bar (logo, nav, event status pill + countdown, notification bell placeholder, user menu, palette button that
   opens the theme customizer), footer, mobile bottom navigation under 768 px, command-palette shell (Ctrl/Cmd+K), lazy routes with skeleton
   fallbacks, per-route error boundary, 404 and 403 pages, offline banner.
4. API layer: src/api/client.ts (fetch wrapper: unwrap the envelope, typed ApiError, 401 -> /login?returnTo=),
   src/api/types.ts + zod schemas mirroring docs/api.md, a query-key factory, and one hook per endpoint.
5. MSW mocks in src/mocks with REALISTIC fixtures: 12 teams, 60 players, the 10 challenges from section 10, three days of
   solves with a believable score distribution, feed events, announcements. Toggle with VITE_USE_MOCKS=true so the UI
   can be built before the backend exists.
6. Shared components: TeamAvatar (deterministic 5x5 pixel identicon in the accent color), CategoryIcon and CategoryBadge, DifficultyBadge,
   PointsBadge, CopyButton, Countdown (server-time offset corrected), EmptyState, Skeleton variants, ConfirmDialog.
7. Tooling: Vitest + React Testing Library + MSW test setup, Playwright config, npm scripts (dev, build, lint, typecheck,
   test, e2e).

First show a short plan. After I approve, implement, then run lint, typecheck, test and build. Use Playwright to capture
screenshots of the shell at 360, 768 and 1280 px in three themes (Matrix Green, Amber CRT, Paper) and inspect them critically. Fix anything generic, misaligned or cramped
before you report.
```

#### PROMPT 7b: Landing, auth, rules (Role D)
```
Read CLAUDE.md and docs/PLAYBOOK.md section 8 (especially 8.5 items R-01 to R-06, R-26, R-30, R-37 to R-39).

Task:
1. Boot-sequence intro (once per session, skippable with any key, disabled when effects are reduced), then the landing page:
   ASCII-wordmark hero with a terminal typing effect, live stats (teams, challenges, total solves), event countdown
   or a LIVE pill, top-5 preview from the public scoreboard, "how it works" section, Rules/FAQ accordion, footer.
2. Login and Register: split layout, react-hook-form + zod inline validation, password strength meter, show/hide password,
   server errors mapped onto the right fields, returnTo redirect after login.
3. Rules page. Auth context (useMe query), guarded routes, admin-only guard.
4. Terminal-styled 404 (`bash: /page: command not found`) and error pages (stderr-style blocks with a retry command).
Every page has loading, empty and error states, is keyboard and screen-reader friendly and is responsive.
Tests: component tests for the forms and guards. Playwright: register -> login -> logout against the mocks.
Verify visually with screenshots at 360/768/1280 and iterate on polish before reporting.
```

#### PROMPT 7c: Challenges, team, profiles (Role D)
```
Read CLAUDE.md and docs/PLAYBOOK.md section 8 (R-12 to R-20, R-25, R-31).

Task:
1. Challenges page: sticky filter bar (category tabs with counts, difficulty chips, solved/unsolved/locked filter, search),
   responsive card grid. Cards show the category color and icon, difficulty, current points with a decay indicator
   (tooltip with a mini decay-curve: initial -> current -> minimum), solve count, solved tick, a lock overlay naming the
   missing prerequisites, and a first-blood crown when your team holds it.
2. Challenge dialog, deep-linkable at /challenges/:id: sanitized markdown description with code highlighting, attachment
   cards with download, recent solvers, hints accordion with cost badges and a confirmation step ("Unlock for -N pts?"),
   a monospace flag input with a CTF{...} placeholder. Model the submission as an explicit state machine with these states:
   idle, submitting, wrong (input shake + attempts left before cooldown), cooldown (button disabled with live countdown),
   already-solved, locked, closed, correct (confetti + animated points; an extra celebration and a team-wide toast for
   first blood).
3. Team page: create or join with an invite code, members list with captain crown, copy and regenerate invite, kick and
   leave with confirmation, empty state for players without a team, team score summary.
4. Team and Player profile pages: avatar header, stats, badges, solve timeline, category radar chart (Recharts), recent solves.
Tests: component tests covering every submission result code. Playwright: solve a challenge, unlock a hint, hit the
cooldown. Iterate on visual polish with screenshots.
```

#### PROMPT 7d: Scoreboard, real-time, notifications (Role D)
```
Read CLAUDE.md and docs/PLAYBOOK.md section 8 (R-07 to R-11, R-21 to R-24, R-28, R-29) and the SSE section of docs/api.md.

Task:
1. Scoreboard page: table with rank medals for the top 3, avatars, monospace scores, solved-per-category dots, last-solve
   time, animated row reordering on rank changes (Framer Motion layout) with green/red rank-delta arrows, search, "my team"
   highlight with a jump button, frozen banner with the snapshot time, top-N timeline chart (Recharts: hover tooltip, legend
   toggles, range selector). Skeleton and empty states. On mobile the table collapses into cards.
2. Real-time: a single useEventStream hook connecting to GET /api/events/stream (SSE) with reconnect and backoff, falling
   back to TanStack Query polling (5 s) if SSE is unavailable. Route messages into the query cache.
3. Activity feed: side panel on desktop and a page on mobile, grouped by time, an icon per event type, first-blood
   highlights, and a "new events" pill when scrolled away from the top.
4. Notification bell: unread count, dropdown with announcements and personal events (your team solved, hint unlocked,
   cooldown, flag rejected), mark all read (persist read state in localStorage).
5. Announcement banner with severity styling and dismiss.
Tests: rank animation never breaks ordering, SSE reconnect with a fake EventSource. Playwright: two browser contexts,
one solves, the other sees the feed and scoreboard update live.
```

#### PROMPT 7e: Admin area (Role D)
```
Read CLAUDE.md and docs/PLAYBOOK.md section 8 (R-32 to R-36) and section 6.

Task: implement /admin with a sidebar layout.
- Event control: large state indicator (Not started / Live / Paused / Frozen / Ended), actions with confirmation, typed
  confirmation ("END") for ending, freeze-time picker, server time display.
- Challenge management: TanStack Table (sort, filter, pagination, column visibility, visibility toggle) and an editor
  (react-hook-form + zod) with category, difficulty, base points, scoring strategy, min points and decay solves with a LIVE
  decay-curve preview chart (display-only, labeled as a preview), dynamic-flag toggle, prerequisites picker with a cycle
  warning, hints editor with costs, attachments, and a live markdown preview.
- Live scoreboard (always live, with a "publicly frozen" indicator), Submissions table (filters by team, challenge and
  result, live tail, CSV export), Alerts panel (severity badges, evidence drawer with the involved teams, dismiss),
  Announcements composer and history.
- Reveal-team-flag tool (demo-only) inside challenge detail, with a warning label.
Admin routes are hidden from non-admins and 403 responses render the Forbidden page.
Tests: form validation, cycle-warning logic. Playwright admin flow: create a challenge and see it in the player view.
```

#### PROMPT 7f: Realism and polish audit (Role D, after Prompt 8 so it runs on the real backend)
```
Read CLAUDE.md and docs/PLAYBOOK.md section 8.5.

Task: run the "feels real" audit against the running app (real backend, seeded data), line by line.
1. For each R-item write PASS or FAIL with evidence (screenshot path or test name) in docs/ui-audit.md.
2. Fix every FAIL. Focus on spacing and typography consistency, hover/focus/active states, animation timing,
   empty/loading/error states, microcopy (no lorem, no placeholders) and visual hierarchy.
3. Accessibility: run axe via Playwright on every route, fix all serious and critical issues, and verify keyboard-only use of
   the challenge dialog, admin forms and command palette.
4. Responsive: capture screenshots at 360, 768, 1280 and 1920 px for every route, and fix overflow and cramped layouts.
   Repeat the key routes in every theme preset and one custom accent, and run axe contrast checks in each (R-42 to R-53).
5. Performance: production build, Lighthouse (performance and accessibility >= 90 on /challenges and /scoreboard),
   verify route-level code splitting, and add a bundle report to docs/.
6. Remove console errors and warnings, unused code and unused dependencies.
Report remaining known issues honestly.
```

#### PROMPT 8: Seed CTF, integration, end-to-end
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 10 and 11.

Task:
1. Create data/seed/: 1 admin, 12 sample teams with players (names in section 10), and the 10 sample challenges from section 10 (with
   hints, prerequisites, mixed scoring strategies, two dynamic-flag challenges).
2. Write scripts/demo_traffic (a small shell or Python script using curl or requests) that simulates teams solving
   challenges over time, so the leaderboard, timeline and first-blood events look alive during a demo.
3. Write an end-to-end checklist test (docs/e2e-checklist.md) and Playwright tests (frontend/e2e) that drive the real UI against the real backend, plus, where practical, an API smoke test that
   walks the whole flow through the HTTP API.
4. Fix every bug found, adding a regression test for each.
Report anything that does not match the PLAYBOOK.
```

#### PROMPT 9: Hardening and documentation
```
Read CLAUDE.md and docs/PLAYBOOK.md sections 12 and 13.

Task:
1. Security pass per the checklist in section 12; fix findings and add tests.
2. Run with sanitizers (-fsanitize=address,undefined and, separately, thread) and fix issues. Also run Lighthouse and axe
   against the production build of the frontend and fix findings.
3. Fill in docs/uml/oop-mapping.md with real file:line references for each OOP concept.
4. Produce docs/report.md following the outline in section 13, and docs/demo-script.md following section 14.
5. Update README with setup, admin creation, run instructions and screenshots placeholders.
Confirm a clean-clone build works for both backend and frontend using the build steps in CLAUDE.md.
```

### 9.6 Review prompt (end of every session)
```
Act as a strict reviewer. Compare what was just implemented with docs/PLAYBOOK.md and CLAUDE.md.
1. List any violation of the hard rules (I/O in core, raw new/delete, plain flags, game logic in server, etc.).
2. List missing tests and untested failure paths.
3. Check const-correctness, virtual destructors, override usage, and lifetimes/dangling references.
4. List which OOP concepts from section 5.2 this change demonstrates, with file names.
5. List anything that a student would struggle to explain in a viva, and explain it simply.
Do not change code yet. Give me a prioritized fix list.
```

### 9.7 Ad-hoc task prompt template
```
Context: read CLAUDE.md and docs/PLAYBOOK.md section <X>.
Goal: <one sentence>.
Scope: touch only <files/directories>.
Constraints: <e.g. no new dependencies, keep API unchanged>.
Done when: <build passes + these tests pass + behavior visible in browser>.
First give me a short plan. Wait for my OK before editing.
```

### 9.8 Bug report prompt template
```
Bug: <what you did, what you expected, what happened>.
Evidence: <error text / failing test / browser console message / request + response>.
Please: 1) find the root cause, 2) add a failing regression test, 3) fix it minimally, 4) run the full test suite.
```

---

## 10. Sample CTF (seed data)

Flags are placeholders. Store only hashes in the seed. Point values are the initial values.

| # | Title | Category | Difficulty | Pts | Scoring | Prereq | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Welcome Flag | Misc | Easy | 50 | Static | none | Flag in the description |
| 2 | Inspect Me | Web | Easy | 100 | Decay | none | Flag hidden in the page source |
| 3 | Caesar's Secret | Crypto | Easy | 100 | Decay | none | Shift cipher |
| 4 | Robots Rule | Web | Medium | 200 | Decay + FirstBlood | 2 | Hint 1 (−20), Hint 2 (−40) |
| 5 | Base Camp | Crypto | Medium | 200 | Decay | 3 | Multi-layer encoding |
| 6 | Hidden Pixels | Forensics | Medium | 250 | Decay + FirstBlood | none | Metadata in image |
| 7 | Team Token | Web | Medium | 300 | **Dynamic flag** | 4 | Per-team flag demo |
| 8 | Crackme Lite | Reverse | Hard | 400 | Decay + FirstBlood | 5 | |
| 9 | Overflow 101 | Pwn | Hard | 450 | Decay | 8 | |
| 10 | Final Boss | Misc | Hard | 500 | **Dynamic flag** + FirstBlood | 7, 9 | Two prerequisites |

Sample teams (12, 2-4 players each, with staggered solve times over several days so the timeline chart has a realistic shape): `NullPointers`, `SegFaultSquad`, `StackSmashers`, `RootAccess`, `ByteBenders`, `Kernel Panic`, `0xDEADBEEF`, `PacketSniffers`, `SudoMakeSandwich`, `HashBrowns`, `Ctrl+Alt+Defeat`, `LeetSpeakers`.

---

## 11. Testing strategy

| Level | Tool | What |
|---|---|---|
| Unit | Catch2 | Every class, success and failure paths |
| Property style | Catch2 generators | Decay is monotonic non-increasing and ≥ minPoints, ranking is a strict total order |
| Concurrency | Catch2 + ThreadSanitizer | N threads submitting/joining simultaneously |
| API | In-process httplib client | Auth, permissions, envelope, no flag leaks |
| Frontend unit / component | Vitest + React Testing Library + MSW | Forms, the flag-submission state machine, guards, hooks |
| E2E | Playwright (real browser, real backend) | Full flow with multiple browser contexts (live updates between teams) |
| Accessibility | axe via Playwright | Every route, zero serious/critical issues, in every preset |
| Theme system | Vitest + Playwright screenshots | Contrast utility and color derivation (unit), every preset defines every token, visual snapshot per preset, no flash on load |
| Performance | Lighthouse (production build) | ≥ 90 performance and accessibility on `/challenges`, `/scoreboard` |
| Manual | Checklist | Full flow in a real browser with 3 windows |
| Regression | Every fixed bug | A test that would have failed before the fix |

**Definition of done for any task:** compiles with zero warnings · tests added and passing · no rule in CLAUDE.md violated · reviewed by a teammate · merged via PR · docs updated if behavior changed. **For UI tasks also:** lint, typecheck and component tests pass, loading/empty/error states exist, checked at 360 / 768 / 1280 px, and the relevant R-items in section 8.5 are ticked.

---

## 12. Security checklist

- [ ] Flags never in any player-facing response, log line or error message
- [ ] Flag comparison uses constant-time compare on hashes
- [ ] Passwords salted + hashed, never logged
- [ ] Session tokens are random 128-bit, `HttpOnly`, `SameSite=Strict`, expire
- [ ] Every mutating endpoint checks auth, role and team membership
- [ ] Request body size limit and JSON schema validation
- [ ] Username/team-name length limits and character whitelist
- [ ] React's output escaping is never bypassed: no `dangerouslySetInnerHTML` except markdown sanitized with `rehype-sanitize`
- [ ] No tokens or flags in `localStorage` / `sessionStorage`. Session lives only in the HttpOnly cookie
- [ ] Server secret loaded from file/env, never committed
- [ ] Rate limiting on login and submit endpoints
- [ ] Internal errors return generic 500, with no stack traces or file paths
- [ ] `data/runtime` and secrets git-ignored

---

## 13. Report outline (docs/report.md)

1. Introduction and problem statement
2. Requirements (FR/NFR tables)
3. System architecture (diagram from section 3)
4. Class design and UML (class, sequence, use case)
5. OOP concepts implemented (table with file:line references)
6. Design patterns used and why (Strategy, Observer, Factory, Facade, Decorator)
7. Novelty features (dynamic scoring, first blood, hints, per-team flags and anti-cheat, freeze, timeline)
8. Implementation highlights (thread-safety, persistence, security)
9. Testing (strategy, coverage, sanitizer results)
10. Screenshots of the website
11. Challenges faced and lessons learned
12. Future scope (containerized challenges, team chat, OAuth, database, multi-event)
13. Individual contribution table
14. References

---

## 14. Demo script (5-7 minutes)

1. **(30s)** Problem and architecture in one slide.
2. **(30s)** Admin logs in, opens the Event Control tab, starts the event.
3. **(60s)** Admin creates a new challenge live: dynamic scoring, one costed hint, prerequisite set.
4. **(60s)** Two browser windows as Team A and Team B: register, create/join teams.
5. **(90s)** Team A solves a challenge, **first blood** toast and feed event appear on both windows. Team B solves the same challenge and the **points decay** visibly on the board.
6. **(30s)** Team B unlocks a hint and the **score drops by the hint cost**.
7. **(60s)** **Anti-cheat:** admin reveals Team A's per-team flag and Team B submits it. **Flag sharing alert** appears in the admin panel.
8. **(30s)** Set the freeze time. Public board freezes with a banner while the admin board stays live.
9. **(30s)** Show the timeline chart, then restart the server to prove **persistence**.
10. **(60s)** Open the code and point at the OOP mapping table: abstract `Challenge`, virtual `checkFlag`, `IScoringStrategy`, `EventBus`, `Repository<T>`, `operator<`.

**Backup plan:** keep a recorded video of the demo and a pre-seeded data folder in case something breaks live.

---

## 15. Viva cheat-sheet: questions you must be able to answer

- Why is `Challenge` abstract, and what breaks if `checkFlag` isn't virtual?
- Why a virtual destructor in the base class?
- Why Strategy for scoring rather than `if/else` on challenge type?
- How does adding a new observer avoid touching `CTFManager`?
- Why are scores *derived* instead of stored? What does that buy you?
- How do you make sure two teams submitting simultaneously can't both get first blood?
- What does `operator<` on `Team` compare, and why is it a strict weak ordering?
- Why is `Repository<T>` a template, and what does the compiler do with it?
- Where do you use RAII? Show an example.
- How are flags protected from leaking? How does the per-team flag detect sharing?
- What is the Rule of Five, and which class needed it?
- Why does the core library have no I/O?
- Why does the React app never compute scores or ranks itself?
- How does the UI stay in sync in real time (SSE vs polling), and what happens when the connection drops?

---

## 16. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep from novelty list | High | High | Scope guard in 6; cut in the stated order |
| Merge conflicts between group members | Medium | Medium | Layer ownership, small PRs, headers frozen after Phase 1 |
| Claude Code produces code nobody understands | Medium | High | Explain-prompts, review prompt, viva cheat-sheet, pair-review |
| Race conditions on the server | Medium | High | Single `shared_mutex` in `CTFManager`, ThreadSanitizer, stress test |
| Dependency or build problems on someone's OS | Medium | Medium | `FetchContent`, CI on Ubuntu and Windows, documented build steps for backend and frontend |
| Frontend looks unpolished | Medium | Medium | Design tokens, the R-checklist (8.5), Playwright screenshots reviewed in every PR, dedicated polish phase (7f) |
| Frontend and backend drift apart | Medium | High | `docs/api.md` is the contract. Zod-parsed responses, MSW mocks built from the same file, API tests on the server side |
| Frontend blocked waiting for the backend | Medium | Medium | Build against MSW mocks (`VITE_USE_MOCKS=true`), switch to the real backend in Phase 8 |
| SSE connections exhaust server threads | Low | Medium | Larger httplib thread pool, heartbeat + disconnect cleanup, polling fallback in the UI |
| Node toolchain problems on someone's machine | Medium | Low | Pin Node 20 LTS (`.nvmrc`), `npm ci`, CI job for the frontend |
| Live demo failure | Medium | High | Seed data, recorded backup video, rehearsal in Phase 9 |
| Flag leak bug | Low | High | API tests that scan responses, security checklist |

---

## 17. Quick-start checklist for the group

1. [ ] Create the Git repo, add this file as `docs/PLAYBOOK.md`. Install CMake, a C++17 compiler and Node 20 LTS
2. [ ] Assign roles A-D (section 9.1)
3. [ ] Run **Prompt 0**, then review and merge
4. [ ] Run **Prompt 1** together, and approve the UML + headers as a group before anyone codes
5. [ ] Split into branches and run Prompts 2, 3 and 7a in parallel
6. [ ] Merge, then Prompts 4, 5, 6 (backend) and 7b, 7c, 7d, 7e (frontend, on mocks)
7. [ ] Prompt 8 (integration, switch the frontend from mocks to the real backend), then 7f (realism and polish audit), then Prompt 9 (hardening and docs)
8. [ ] Rehearse the demo twice
