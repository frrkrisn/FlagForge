# Sequence: Player submits a flag

`POST /api/challenges/:id/submit` — the central flow that exercises polymorphism (virtual
`checkFlag` and `pointsFor`), the Observer pattern (one solve fans out to many observers), and
the single-writer lock in `CTFManager`.

```mermaid
sequenceDiagram
    autonumber
    actor P as Player (browser)
    participant R as ApiRouter (server)
    participant S as SessionManager
    participant M as CTFManager (facade)
    participant C as Challenge (StaticChallenge/DynamicFlagChallenge)
    participant CD as CooldownTracker
    participant SC as IScoringStrategy
    participant B as EventBus
    participant OBS as Observers (ActivityFeed, EventLog, AntiCheatMonitor)
    participant J as JsonStore

    P->>R: POST /api/challenges/42/submit { flag }
    R->>S: lookup(session cookie)
    alt no / invalid session
        S-->>R: none
        R-->>P: 401 { ok:false, error:UNAUTHENTICATED }
    else authenticated
        S-->>R: userId
        R->>M: submitFlag(userId, challengeId, flag)
        activate M
        Note over M: acquire unique_lock(mutex_)

        M->>M: check event state == Running
        alt event not running
            M-->>R: throw CompetitionClosedException
            R-->>P: 403 { error:CLOSED }
        end

        M->>M: resolve team of userId (must be in a team)
        M->>M: prerequisites solved by team?
        alt missing prerequisite
            M-->>R: throw ChallengeLockedException
            R-->>P: 423 { error:LOCKED }
        end

        M->>CD: isOnCooldown(teamId, challengeId, now)
        alt on cooldown
            CD-->>M: true (secondsLeft)
            M->>B: publish(CooldownTriggered)
            M-->>R: throw CooldownException
            R-->>P: 429 { error:COOLDOWN, retryAfter }
        end

        M->>M: already solved by team?
        alt duplicate
            M-->>R: throw DuplicateSolveException
            R-->>P: 409 { error:CONFLICT }
        end

        M->>C: checkFlag(ctx, flag)   %% virtual dispatch
        activate C
        C-->>M: bool matches
        deactivate C

        alt wrong flag
            M->>M: does flag match ANOTHER team's dynamic flag?
            alt matches another team (sharing)
                M->>B: publish(FlagSharing, teamA, teamB)
                B->>OBS: onEvent(FlagSharing)
                M-->>R: result = FLAG_SHARING (rejected + logged)
            else genuinely wrong
                M->>CD: recordWrong(teamId, challengeId, now)
                M->>B: publish(WrongAttempt)
                B->>OBS: onEvent(WrongAttempt)
                M-->>R: result = WRONG (attemptsLeft)
            end
            R-->>P: 200 { data:{ result, ... } }
        else correct flag
            M->>M: firstBlood = (challenge.solveCount == 0)
            M->>SC: pointsFor(ctx{solveCount, firstBlood})  %% strategy
            SC-->>M: awardedPoints
            M->>M: append SolveRecord to team; mark solve
            opt first blood
                M->>M: grant FIRST_BLOOD badge
                M->>B: publish(FirstBlood)
            end
            M->>B: publish(Solve)
            B->>OBS: onEvent(Solve / FirstBlood)
            M->>J: persist (atomic write)
            M-->>R: result = CORRECT { awardedPoints, firstBlood }
            deactivate M
            R-->>P: 200 { data:{ result:"CORRECT", points, firstBlood } }
            Note over R,OBS: SSE /api/events/stream pushes feed + scoreboard to all clients
        end
    end
```

## Why it is designed this way
- **Single source of truth:** all validation and scoring happen server-side inside one
  `unique_lock`, so two teams submitting simultaneously cannot both be awarded first blood.
- **Polymorphism:** `checkFlag` and `pointsFor` are virtual; `CTFManager` never switches on the
  concrete challenge or scoring type.
- **Observer:** publishing an event is all `CTFManager` does; adding a new observer needs zero
  changes to this method.
- **Scores are derived** (PLAYBOOK §6.1): the `SolveRecord` stores *that* a team solved, not the
  points; the `Scoreboard` recomputes current value on demand so decay affects everyone equally.
