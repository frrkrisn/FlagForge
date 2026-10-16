# FlagForge API Contract (v1)

> **This file is the contract.** The C++ server, the React app's zod schemas
> (`frontend/src/api/`) and the MSW mocks (`frontend/src/mocks/`) are all built from it.
> Any deviation is a bug. Base path for all endpoints: **`/api`**.

---

## 1. Response envelope

Every response is JSON with one of two shapes.

**Success**
```json
{ "ok": true, "data": { } }
```

**Failure**
```json
{ "ok": false, "error": { "code": "TEAM_FULL", "message": "This team is full (max 4)." } }
```

- `code` is a stable machine-readable string (see §3). `message` is human-readable and safe to
  show; it never contains a flag, stack trace, or file path.
- Clients switch on `code`, never on `message` text.

## 2. Auth

- Session is a cookie: `session=<token>`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` in
  production. Set on login/register, cleared on logout. **No tokens in localStorage.**
- Token is a random 128-bit value; sessions expire (default 12h) and can be revoked.
- Middleware attaches the current user. Routes marked **user** require a session; **captain**
  requires the caller to be their team's captain; **admin** requires `role == "ADMIN"`.
- Missing/invalid session on a protected route → `401 UNAUTHENTICATED`. Wrong role → `403 FORBIDDEN`.

## 3. Error codes → HTTP status

| Exception (C++) | HTTP | `code` |
|---|---|---|
| `ValidationException` | 400 | `VALIDATION` |
| `AuthException` | 401 | `UNAUTHENTICATED` |
| `PermissionException` | 403 | `FORBIDDEN` |
| `CompetitionClosedException` | 403 | `CLOSED` |
| `NotFoundException` | 404 | `NOT_FOUND` |
| `DuplicateSolveException` | 409 | `CONFLICT` |
| `TeamFullException` | 409 | `TEAM_FULL` |
| `ChallengeLockedException` | 423 | `LOCKED` |
| `CooldownException` | 429 | `COOLDOWN` |
| (rate limit) | 429 | `RATE_LIMITED` |
| anything else | 500 | `INTERNAL` |

`VALIDATION` errors may include a `fields` object mapping field name → message:
```json
{ "ok": false, "error": { "code": "VALIDATION", "message": "Invalid input.",
  "fields": { "username": "3–20 chars, [a-zA-Z0-9_-] only." } } }
```

## 4. Shared data types (DTOs)

Field names are exact. Timestamps are ISO-8601 UTC strings (`2026-09-29T14:03:00Z`).
IDs are opaque strings. Enums are UPPER_SNAKE unless noted.

```
Role            = "PLAYER" | "ADMIN"
Category        = "WEB" | "CRYPTO" | "FORENSICS" | "REVERSE" | "PWN" | "MISC"
Difficulty      = "EASY" | "MEDIUM" | "HARD"
EventState      = "NOT_STARTED" | "RUNNING" | "PAUSED" | "ENDED"
Severity        = "INFO" | "WARNING" | "CRITICAL"
SubmitResult    = "CORRECT" | "WRONG" | "ALREADY_SOLVED" | "LOCKED" | "COOLDOWN"
                | "CLOSED" | "FLAG_SHARING"
Badge           = "FIRST_BLOOD" | "TEAM_CREATED" | ... (string; render by known set)
ScoringStrategy = "STATIC" | "DECAY" | "DECAY_FIRSTBLOOD" | "DYNAMIC" | "DYNAMIC_FIRSTBLOOD"
```

```jsonc
// UserPublic — safe to show to anyone
{ "id": "u_neo", "username": "neo", "role": "PLAYER", "bio": "...",
  "avatarSeed": "neo", "teamId": "t_null", "personalSolves": 7,
  "badges": ["FIRST_BLOOD"] }

// Me — the authenticated user (adds email, themePrefs, team)
{ "id": "u_neo", "username": "neo", "email": "neo@example.com", "role": "PLAYER",
  "bio": "...", "avatarSeed": "neo", "themePrefs": "{...opaque...}",
  "team": TeamSummary | null }

// TeamSummary
{ "id": "t_null", "name": "NullPointers", "score": 1340, "rank": 3, "solves": 6 }

// TeamMember
{ "id": "u_neo", "username": "neo", "avatarSeed": "neo",
  "isCaptain": true, "personalSolves": 4 }

// Team (full; inviteCode present only for the caller's own team + captain)
{ "id": "t_null", "name": "NullPointers", "captainId": "u_neo",
  "inviteCode": "J7X2QF", "members": [TeamMember],
  "score": 1340, "rank": 3, "solves": 6,
  "badges": ["FIRST_BLOOD"], "solvedChallengeIds": ["c_1","c_2"] }

// ChallengeListItem — NO flag, NO hint text
{ "id": "c_4", "title": "Robots Rule", "category": "WEB", "difficulty": "MEDIUM",
  "basePoints": 200, "currentPoints": 173, "minPoints": 40, "decay": 10,
  "solveCount": 4, "solved": false, "locked": true,
  "missingPrerequisites": [{ "id": "c_2", "title": "Inspect Me" }],
  "firstBloodByMyTeam": false, "hasHints": true }

// ChallengeDetail — adds description + hints (text only if unlocked)
{ ...ChallengeListItem,
  "description": "# markdown ...",
  "attachments": [{ "name": "capture.pcap", "size": 20480 }],
  "recentSolvers": [{ "teamId": "t_seg", "teamName": "SegFaultSquad",
                      "at": "2026-09-27T10:00:00Z" }],
  "hints": [{ "id": "h_1", "cost": 20, "unlocked": false },
            { "id": "h_2", "cost": 40, "unlocked": true, "text": "Check /robots.txt" }],
  "prerequisites": [{ "id": "c_2", "title": "Inspect Me", "solved": true }],
  "scoring": { "strategy": "DECAY_FIRSTBLOOD", "initial": 200, "min": 40,
               "decay": 10, "current": 173 } }

// ScoreRow
{ "rank": 1, "teamId": "t_seg", "teamName": "SegFaultSquad", "avatarSeed": "SegFaultSquad",
  "score": 1980, "solves": 8, "lastSolveAt": "2026-09-28T09:12:00Z",
  "categorySolves": { "WEB": 3, "CRYPTO": 2, "FORENSICS": 1, "REVERSE": 1, "PWN": 1, "MISC": 0 },
  "rankDelta": 2 }

// FeedEvent
{ "id": 812, "type": "FIRST_BLOOD", "at": "2026-09-28T09:12:00Z",
  "teamName": "SegFaultSquad", "challengeTitle": "Crackme Lite",
  "message": "SegFaultSquad drew first blood on Crackme Lite" }

// Announcement
{ "id": "a_3", "title": "Round 2 is live", "body": "New Pwn challenges added.",
  "severity": "INFO", "at": "2026-09-28T08:00:00Z" }

// Alert (admin)
{ "id": "al_9", "kind": "FLAG_SHARING", "status": "OPEN", "at": "2026-09-28T09:20:00Z",
  "evidence": "Team ByteBenders submitted NullPointers' flag for 'Team Token'.",
  "teams": ["t_byte", "t_null"], "challengeId": "c_7" }

// Submission (admin)
{ "id": "s_100", "at": "2026-09-28T09:12:00Z", "teamName": "SegFaultSquad",
  "playerName": "trinity", "challengeTitle": "Crackme Lite", "result": "CORRECT" }
```

---

## 5. Endpoints

Legend for **Auth**: `none` · `user` · `captain` · `admin`.

### 5.1 Auth & profile

#### `POST /api/auth/register` — `none`
Registers a user. The **first ever** user (or a seeded one) becomes `ADMIN`; others are `PLAYER`.
Sets the session cookie.
```jsonc
// req
{ "username": "neo", "email": "neo@example.com", "password": "correct horse battery" }
// 200
{ "ok": true, "data": { "user": Me } }
// errors: 400 VALIDATION (username/email/password rules), 409 CONFLICT (username/email taken)
```

#### `POST /api/auth/login` — `none`
```jsonc
// req
{ "username": "neo", "password": "correct horse battery" }
// 200 (sets cookie)
{ "ok": true, "data": { "user": Me } }
// errors: 401 UNAUTHENTICATED (bad credentials), 429 RATE_LIMITED
```

#### `POST /api/auth/logout` — `user`
Clears the session. `200 { "ok": true, "data": { "loggedOut": true } }`.

#### `GET /api/auth/me` — `user`
Returns the current user, team and `themePrefs`. `200 { "ok": true, "data": Me }`.
Unauthenticated → `401 UNAUTHENTICATED` (the client uses this to gate routes).

#### `PATCH /api/users/me` — `user`
Update `bio`, `avatarSeed`, and/or `themePrefs`. `themePrefs` is an **opaque** JSON string
(max 2 KB), stored verbatim and never rendered as HTML by the server.
```jsonc
// req (any subset)
{ "bio": "hi", "avatarSeed": "neo2", "themePrefs": "{\"preset\":\"amber\"}" }
// 200 -> { "ok": true, "data": Me }
// errors: 400 VALIDATION (bio length, themePrefs too large / not valid JSON)
```

#### `GET /api/users/:id` — `none`
Public player profile. `200 { "ok": true, "data": UserPublic }`. `404 NOT_FOUND`.

### 5.2 Teams

#### `POST /api/teams` — `user`
Create a team; caller becomes captain. Fails if the caller is already in a team.
```jsonc
// req { "name": "NullPointers" }
// 200 { "ok": true, "data": Team }         // includes inviteCode
// errors: 400 VALIDATION, 409 CONFLICT (already in a team / name taken)
```

#### `POST /api/teams/join` — `user`
```jsonc
// req { "inviteCode": "J7X2QF" }
// 200 { "ok": true, "data": Team }
// errors: 404 NOT_FOUND (bad code), 409 TEAM_FULL, 409 CONFLICT (already in a team)
```

#### `POST /api/teams/leave` — `user`
Leaves the current team. If the captain leaves, captaincy transfers to the next member; an empty
team is deleted. `200 { "ok": true, "data": { "left": true } }`.

#### `GET /api/teams/me` — `user`
The caller's team (with `inviteCode` if captain). `200 { data: Team }` · `404 NOT_FOUND` (no team).

#### `GET /api/teams/:id` — `none`
Public team profile (no `inviteCode`). `200 { data: Team }` · `404 NOT_FOUND`.

#### `POST /api/teams/me/kick` — `captain`
```jsonc
// req { "playerId": "u_trinity" }
// 200 { data: Team }
// errors: 403 FORBIDDEN (not captain), 404 NOT_FOUND (not a member), 400 VALIDATION (can't kick self)
```

#### `POST /api/teams/me/invite/regenerate` — `captain`
`200 { "ok": true, "data": { "inviteCode": "K9M4TT" } }`.

### 5.3 Event & challenges

#### `GET /api/event/status` — `none`
```jsonc
// 200
{ "ok": true, "data": {
  "state": "RUNNING", "startAt": "2026-09-27T09:00:00Z", "endAt": "2026-09-30T09:00:00Z",
  "freezeAt": "2026-09-30T08:00:00Z", "frozen": false,
  "serverTime": "2026-09-29T14:03:00Z" } }
```
`serverTime` drives client countdowns (client corrects for clock skew).

#### `GET /api/challenges` — `user`
List with per-team state. Never includes flags or hint text.
```jsonc
// 200 { "ok": true, "data": { "challenges": [ChallengeListItem] } }
```

#### `GET /api/challenges/:id` — `user`
Detail. Hint `text` present only for hints this team has unlocked.
`200 { data: ChallengeDetail }` · `404 NOT_FOUND`.

#### `GET /api/challenges/:id/files/:name` — `user`
Downloads an attachment as a binary response with `Content-Disposition: attachment` and
`X-Content-Type-Options: nosniff`. Same rules as the board: the challenge must be visible, the event
must be running, and the team must have solved the prerequisites (admins may always download).
`ChallengeDetail.attachments[]` is `{ name, size, sha256 }`, so players can verify the file.
`404 NOT_FOUND` (unknown or hidden) · `403 CLOSED` · `423 LOCKED`.

#### `POST /api/challenges/:id/submit` — `user` (must be in a team)
```jsonc
// req { "flag": "CTF{...}" }
// 200 — result varies:
{ "ok": true, "data": { "result": "CORRECT", "awardedPoints": 173,
                        "firstBlood": true, "newTeamScore": 1513 } }
{ "ok": true, "data": { "result": "WRONG", "attemptsLeft": 3 } }
{ "ok": true, "data": { "result": "ALREADY_SOLVED" } }
{ "ok": true, "data": { "result": "FLAG_SHARING" } }   // rejected + alert raised
// thrown (not 200): 423 LOCKED, 429 COOLDOWN { retryAfterSeconds }, 403 CLOSED,
//                   400 VALIDATION (flag empty / not in a team → 403 FORBIDDEN)
```
> Design note: `WRONG` / `ALREADY_SOLVED` / `FLAG_SHARING` are *outcomes* (200 with a `result`).
> `LOCKED` / `COOLDOWN` / `CLOSED` are *refusals* (thrown → non-200). The client handles both.

#### `POST /api/challenges/:id/hints/:hintId/unlock` — `user` (in a team)
Idempotent per team (unlocking twice charges once). Returns the hint text and the new score.
```jsonc
// 200 { "ok": true, "data": { "hintId": "h_1", "text": "Check /robots.txt",
//                            "cost": 20, "newTeamScore": 1493 } }
// errors: 423 LOCKED (challenge locked), 403 CLOSED, 404 NOT_FOUND
```

### 5.4 Scoreboard, feed, announcements, stream

#### `GET /api/scoreboard` — `none`
Public board. **Respects freeze**: after `freezeAt` returns the snapshot taken at freeze time.
```jsonc
// 200 { "ok": true, "data": { "frozen": true, "frozenAt": "2026-09-30T08:00:00Z",
//                            "rows": [ScoreRow] } }
```

#### `GET /api/scoreboard/timeline?top=10` — `none`
```jsonc
// 200 { "ok": true, "data": { "teams": [
//   { "teamId": "t_seg", "teamName": "SegFaultSquad",
//     "points": [ { "t": "2026-09-27T09:05:00Z", "score": 50 }, ... ] } ] } }
```

#### `GET /api/feed?since=<id>` — `none`
Returns events with `id > since` (0 for all recent). `200 { data: { events: [FeedEvent], nextSince: 812 } }`.

#### `GET /api/announcements` — `none`
Newest first. `200 { data: { announcements: [Announcement] } }`.

#### `GET /api/events/stream` — `none` — **Server-Sent Events**
`Content-Type: text/event-stream`. Heartbeat comment every 15 s. Named events:

```
event: event-status
data: {"state":"RUNNING","frozen":false,"serverTime":"2026-09-29T14:03:00Z", ...}

event: feed
data: {"id":813,"type":"SOLVE","at":"...","teamName":"...","challengeTitle":"...","message":"..."}

event: scoreboard
data: {"rows":[ScoreRow]}          // sent on rank changes (respects public freeze)

event: announcement
data: {"id":"a_4","title":"...","body":"...","severity":"WARNING","at":"..."}

: heartbeat                         // comment line, every 15s
```
Client reconnects with backoff and falls back to polling `/api/feed` + `/api/scoreboard` (5 s) if
SSE is unavailable. Messages are routed into the TanStack Query cache.

### 5.5 Admin (all require `admin`; non-admin → `403 FORBIDDEN`)

| Method & path | Body | Returns |
|---|---|---|
| `POST /api/admin/challenges` | `ChallengeSpec` | created `ChallengeDetail` |
| `PUT /api/admin/challenges/:id` | `ChallengeSpec` | updated `ChallengeDetail` |
| `DELETE /api/admin/challenges/:id` | — | `{ "deleted": true }` |
| `POST /api/admin/challenges/:id/visibility` | `{ "visible": true }` | updated item |
| `PUT /api/admin/challenges/:id/files/:name` | raw bytes (`application/octet-stream`, max 25 MB) | `{ "name", "size", "sha256" }`. Stores or replaces a file. `:name` is 1–80 chars of `[A-Za-z0-9._-]`, not starting with `.` |
| `DELETE /api/admin/challenges/:id/files/:name` | — | `{ "deleted": true }` |
| `POST /api/admin/event/start` | — | event status |
| `POST /api/admin/event/pause` | — | event status |
| `POST /api/admin/event/resume` | — | event status |
| `POST /api/admin/event/end` | — | event status |
| `POST /api/admin/event/freeze` | `{ "freezeAt": "2026-09-30T08:00:00Z" }` | event status |
| `GET /api/admin/scoreboard` | — | `{ "rows": [ScoreRow] }` (always live) |
| `GET /api/admin/submissions?team=&challenge=&result=` | — | `{ "submissions": [Submission] }` |
| `GET /api/admin/alerts` | — | `{ "alerts": [Alert] }` |
| `POST /api/admin/alerts/:id/dismiss` | — | updated `Alert` |
| `POST /api/admin/announcements` | `{ title, body, severity }` | created `Announcement` |
| `GET /api/admin/teams/:teamId/flag/:challengeId` | — | `{ "flag": "CTF{...}" }` (demo only) |

```jsonc
// ChallengeSpec (create / edit)
{ "title": "Robots Rule", "category": "WEB", "difficulty": "MEDIUM",
  "description": "# markdown...", "basePoints": 200,
  "scoring": { "strategy": "DECAY_FIRSTBLOOD", "minPoints": 40, "decay": 10 },
  "flagType": "STATIC" | "DYNAMIC",
  "flag": "CTF{...}",              // STATIC only; write-only, never returned
  "flagPrefix": "CTF",            // DYNAMIC only
  "prerequisites": ["c_2"],
  "hints": [{ "text": "Check /robots.txt", "cost": 20 }],
  "attachments": [{ "name": "capture.pcap", "size": 20480 }],
  "visible": true }
// 400 VALIDATION if prerequisites form a cycle or reference unknown ids.
```

---

## 6. Invariants the frontend relies on
1. No flag or unlocked-only hint text ever appears in a **list** response or any player response
   for a challenge the team has not unlocked/solved.
2. Scores are server-computed; the client never recomputes rank or points (only the labeled
   display-only decay-curve preview, from `scoring` params).
3. The public scoreboard and its SSE messages respect the freeze; the admin scoreboard does not.
4. Every list view can be empty (`[]`) — clients must render empty states.
5. `serverTime` is authoritative for countdowns.
