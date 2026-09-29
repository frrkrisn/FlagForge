# Demo Script (5–7 minutes)

Pre-flight: build the backend, start it on a **fresh** data dir, run the seed, start the frontend.

```bash
cmake -S . -B build -G Ninja && cmake --build build -j
./build/bin/ctf_server --port 8080 --data data/runtime --secret-file secret.txt   # empty data/runtime
node scripts/seed.mjs http://localhost:8080
cd frontend && npm run dev    # http://localhost:5173
```

Keep two browser windows open (Team A and an admin) and a terminal for the restart.

1. **(30s) Problem & architecture.** One line: a themeable, real-CTF platform — C++ core + REST
   server + React SPA. Show the architecture sketch in `docs/report.md` §3.
2. **(30s) Admin.** Log in as `admin` / `adminpassword`, open **Admin → Event**; the event is
   already `RUNNING`. Show the live scoreboard is populated (12 teams).
3. **(60s) Create a challenge live.** Admin → Challenges → new: pick `DECAY_FIRSTBLOOD`, a costed
   hint, and a prerequisite; watch the **live decay-curve preview** update as you change min/decay.
4. **(60s) Two teams.** In the second window, register a new player, create a team. Open the
   **Challenges** board; note the point badges and the lock overlay on gated challenges.
5. **(90s) Solve + first blood + decay.** Solve `Welcome Flag` — **confetti** and a toast fire;
   if first, a first-blood celebration. Solve the same challenge from another team and point out the
   **points decay** on the board (both solvers drop together).
6. **(30s) Hint cost.** Unlock a hint (confirm the `−N pts` step); the team score drops by the cost.
7. **(60s) Anti-cheat.** Admin → challenge detail → reveal Team A's per-team flag for **Team Token**;
   submit it from another team → **FLAG_SHARING** result, and it appears in **Admin → Alerts**.
8. **(30s) Freeze.** Admin → Event → set a freeze time in the past; the public **/scoreboard** shows
   the ❄ frozen banner while **Admin → Scoreboard** stays live.
9. **(30s) Persistence.** Ctrl-C the server, restart it on the same data dir, refresh — the board is
   unchanged (state persisted to `state.json`).
10. **(60s) The code.** Open `docs/uml/oop-mapping.md` and jump to: abstract `Challenge::checkFlag`,
    `IScoringStrategy`, `FirstBloodScoring` (decorator), `EventBus` (observer), `Repository<T>`
    (template), `Team::operator<`, and the single `std::shared_mutex` in `CTFManager`.

**Backup plan:** keep a recorded video and a pre-seeded `data/runtime/state.json` in case something
breaks live. The viva cheat-sheet is in `docs/PLAYBOOK.md` §15.
