# FlagForge — CTF Competition Management System

A web-based Capture-The-Flag platform. An admin hosts an event, teams register and solve
challenges by submitting flags, and a live leaderboard ranks them — with real-CTF mechanics:
dynamic scoring, first blood, costed hints, per-team flags, anti-cheat and a scoreboard freeze.

- **Backend:** C++17 (pure `ctf_core` library + `cpp-httplib` REST server), built with CMake.
- **Frontend:** React 18 + TypeScript (strict), Vite, Tailwind — a themeable "hacker terminal" UI.
- **Persistence:** JSON files (no database server).

The full specification lives in [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md). Contributor rules are in
[`CLAUDE.md`](CLAUDE.md). The frontend/backend API contract will live in `docs/api.md`.

---

## Prerequisites

| Tool | Version | For |
|---|---|---|
| C++ compiler | GCC 9+, Clang 10+, or MSVC 2019+ (C++17) | backend |
| CMake | ≥ 3.16 | backend |
| Node.js | 20 LTS (works on newer) | frontend |

CMake pulls all C++ dependencies automatically via `FetchContent` (cpp-httplib, nlohmann/json,
picosha2, Catch2 v3) — no manual installs needed. On Windows the server links `ws2_32`.

> **Windows note:** if you don't have a compiler yet, install one of:
> - MSVC via "Build Tools for Visual Studio" (Desktop development with C++), or
> - MinGW-w64 (there's a "MinGW Installer" shortcut on the Desktop), plus CMake from cmake.org.

---

## Build & run the backend

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j
ctest --test-dir build --output-on-failure
./build/ctf_server --port 8080 --data data/runtime --web frontend/dist
```

Then check the health endpoint:

```bash
curl http://localhost:8080/api/health
# {"ok":true,"data":{"status":"up","version":"0.1.0"}}
```

## Build & run the frontend

```bash
cd frontend
npm ci
npm run dev          # Vite dev server on :5173, proxies /api -> :8080
# or, for a production bundle served by ctf_server:
npm run build        # writes frontend/dist
```

A convenience script builds both:

```bash
./scripts/build-all.sh
```

---

## Admin account

The admin is either **the first user that registers** or a user created by the seed script with
the admin role. See `docs/PLAYBOOK.md` §7. (Seed script arrives in Phase 8.)

## Project status

Bootstrapped (Phase 0). See `docs/PLAYBOOK.md` §9.3 for the phase plan. This repo is being built
phase by phase; `main` is kept green (builds + tests pass).

## License

Coursework project. Not for production use.
