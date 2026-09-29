# Use-Case Diagram

Actors and their use cases (PLAYBOOK.md §2.3). Roles are cumulative: a Captain is a Player, a
Player is a Guest.

```mermaid
flowchart LR
    Guest([Guest])
    Player([Player])
    Captain([Captain])
    Admin([Admin])

    subgraph Public
        UC1[View landing page]
        UC2[View public / frozen leaderboard]
        UC3[Register]
        UC4[Log in]
    end

    subgraph PlayerActions[Player]
        UC5[Create team - becomes captain]
        UC6[Join team by invite code]
        UC7[Leave team]
        UC8[View challenge board]
        UC9[Submit flag]
        UC10[Unlock costed hint]
        UC11[View team & player profiles]
        UC12[Edit own profile & theme]
    end

    subgraph CaptainActions[Captain]
        UC13[Kick member]
        UC14[Regenerate invite code]
    end

    subgraph AdminActions[Admin]
        UC15[CRUD challenges]
        UC16[Toggle challenge visibility]
        UC17[Control event: start/pause/resume/end]
        UC18[Set scoreboard freeze]
        UC19[View live scoreboard]
        UC20[View submissions - filterable]
        UC21[View & dismiss anti-cheat alerts]
        UC22[Post announcements]
        UC23[Reveal team dynamic flag - demo]
    end

    Guest --- UC1 & UC2 & UC3 & UC4
    Player --- UC5 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11 & UC12
    Captain --- UC13 & UC14
    Admin --- UC15 & UC16 & UC17 & UC18 & UC19 & UC20 & UC21 & UC22 & UC23

    Player -.->|is a| Guest
    Captain -.->|is a| Player
    Admin -.->|is a| Guest
```

## Notes
- **Guest → Player**: registering and joining/creating a team promotes a guest to a player.
- **Player → Captain**: creating a team, or being the first member, makes the player captain.
- **Admin** is a distinct role (first registered user or seeded). Admin does not compete but can
  reveal per-team flags for the demo/anti-cheat showcase.
