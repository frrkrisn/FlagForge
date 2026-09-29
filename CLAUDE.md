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
