#ifndef CTF_APP_DTOS_HPP
#define CTF_APP_DTOS_HPP

/// \file Dtos.hpp
/// \brief Plain value structs the CTFManager facade returns. They are copies assembled
///        under the manager's lock, so nothing borrowed escapes it and the server layer
///        only has to map DTO → JSON (docs/api.md §4). No flags/hashes ever appear here.

#include <cstddef>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "ctf/core/Types.hpp"

namespace ctf::app {

struct TeamSummaryDto {
    TeamId id;
    std::string name;
    int score = 0;
    int rank = 0;
    int solves = 0;
};

struct MeDto {
    UserId id;
    std::string username;
    std::string email;
    Role role = Role::Player;
    std::string bio;
    std::string avatarSeed;
    std::string themePrefs;
    std::optional<TeamSummaryDto> team;
};

struct SkillDto {
    Category category = Category::Misc;
    int solved = 0;
    int total = 0;
    int points = 0;
};

struct UserPublicDto {
    UserId id;
    std::string username;
    Role role = Role::Player;
    std::string bio;
    std::string avatarSeed;
    std::optional<TeamId> teamId;
    int personalSolves = 0;
    std::vector<std::string> badges;
    std::vector<SkillDto> skills;  ///< radar from this player's own solves
};

struct TeamMemberDto {
    UserId id;
    std::string username;
    std::string avatarSeed;
    bool isCaptain = false;
    int personalSolves = 0;
};

struct TeamDto {
    TeamId id;
    std::string name;
    UserId captainId;
    std::optional<std::string> inviteCode;  ///< present only for the caller's own captain view
    std::vector<TeamMemberDto> members;
    int score = 0;
    int rank = 0;
    int solves = 0;
    std::vector<std::string> badges;
    std::vector<SkillDto> skills;  ///< radar from the whole team's solves
    std::vector<ChallengeId> solvedChallengeIds;
};

struct PrereqRefDto {
    ChallengeId id;
    std::string title;
    bool solved = false;
};

struct ChallengeListItemDto {
    ChallengeId id;
    std::string title;
    Category category = Category::Misc;
    Difficulty difficulty = Difficulty::Easy;
    int basePoints = 0;
    int currentPoints = 0;
    int minPoints = 0;
    int decay = 10;
    int solveCount = 0;
    bool solved = false;
    bool locked = false;
    std::vector<PrereqRefDto> missingPrerequisites;
    std::vector<ChallengeId> prerequisiteIds;  ///< every prerequisite, for drawing the skill tree
    bool firstBloodByMyTeam = false;
    bool hasHints = false;
};

struct AttachmentDto {
    std::string name;
    std::size_t size = 0;
    std::string sha256;         ///< of the file the requesting team actually receives
    bool personalised = false;  ///< true if each team gets a different version
};

/// A file ready to send to the client (bytes may be personalised for the requesting team).
struct FileDownload {
    std::string name;
    std::string contentType;
    std::string bytes;
};

struct HintDto {
    HintId id;
    int cost = 0;
    bool unlocked = false;
    std::optional<std::string> text;  ///< only when unlocked by the team
};

struct SolverDto {
    TeamId teamId;
    std::string teamName;
    TimePoint at{};
};

struct ScoringDto {
    std::string strategy;
    int initial = 0;
    int min = 0;
    int decay = 10;
    int current = 0;
};

struct ChallengeDetailDto : ChallengeListItemDto {
    std::string description;
    bool hasWriteup = false;              ///< the author wrote one
    std::optional<std::string> writeup;   ///< only once solved by the team (or event ended / admin)
    std::vector<AttachmentDto> attachments;
    std::vector<SolverDto> recentSolvers;
    std::vector<HintDto> hints;
    std::vector<PrereqRefDto> prerequisites;
    ScoringDto scoring;
};

/// Result of POST /submit (docs/api.md §5.3). Which fields are set depends on `result`.
struct SubmitOutcome {
    SubmitResult result = SubmitResult::Wrong;
    std::optional<int> awardedPoints;
    std::optional<bool> firstBlood;
    std::optional<int> attemptsLeft;
    std::optional<int> cooldownSecondsLeft;
    std::optional<int> newTeamScore;
};

struct HintUnlockOutcome {
    HintId hintId;
    std::string text;
    int cost = 0;
    int newTeamScore = 0;
};

struct EventStatusDto {
    EventState state = EventState::NotStarted;
    std::optional<TimePoint> startAt;
    std::optional<TimePoint> endAt;
    std::optional<TimePoint> freezeAt;
    bool frozen = false;
    TimePoint serverTime{};
};

struct SubmissionDto {
    std::string id;
    TimePoint at{};
    std::string teamName;
    std::string playerName;
    std::string challengeTitle;
    SubmitResult result = SubmitResult::Wrong;
};

/// A snapshot of aggregate game state for monitoring (no personal data).
struct StatsDto {
    std::size_t users = 0;
    std::size_t teams = 0;
    std::size_t challenges = 0;
    std::size_t solves = 0;
    std::size_t openAlerts = 0;
    std::string eventState;                                ///< "RUNNING", "ENDED", ...
    std::map<std::string, std::size_t> submissionsByResult;  ///< "CORRECT" -> n
};

/// One message in a team's private war-room chat.
struct ChatMessageDto {
    long long id = 0;
    UserId userId;
    std::string username;
    TimePoint at{};
    std::string text;
};

/// Authentication result: the user plus the freshly minted session token.
struct AuthOutcome {
    MeDto me;
    SessionToken token;
};

}  // namespace ctf::app

#endif  // CTF_APP_DTOS_HPP
