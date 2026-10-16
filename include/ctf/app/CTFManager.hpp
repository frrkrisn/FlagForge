#ifndef CTF_APP_CTFMANAGER_HPP
#define CTF_APP_CTFMANAGER_HPP

/// \file CTFManager.hpp
/// \brief The Facade. The only class the server layer talks to. It owns every domain
///        object, wires the observers to the EventBus, runs the event state machine,
///        and serializes all access behind a single std::shared_mutex (shared lock for
///        reads, unique lock for writes — PLAYBOOK §3.2). It contains all game rules;
///        the server contains none.

#include <memory>
#include <optional>
#include <shared_mutex>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "ctf/app/Dtos.hpp"
#include "ctf/app/SessionManager.hpp"
#include "ctf/core/Announcement.hpp"
#include "ctf/core/Challenge.hpp"
#include "ctf/core/ChallengeFactory.hpp"
#include "ctf/core/Clock.hpp"
#include "ctf/core/Submission.hpp"
#include "ctf/core/Team.hpp"
#include "ctf/core/Types.hpp"
#include "ctf/core/User.hpp"
#include "ctf/events/AntiCheatMonitor.hpp"
#include "ctf/events/CooldownTracker.hpp"
#include "ctf/events/EventBus.hpp"
#include "ctf/events/Observers.hpp"
#include "ctf/persistence/FileStore.hpp"
#include "ctf/persistence/Repository.hpp"
#include "ctf/scoring/Scoreboard.hpp"

namespace ctf::app {

/// Public scoreboard result (respects freeze).
struct ScoreboardResult {
    bool frozen = false;
    std::optional<TimePoint> frozenAt;
    std::vector<scoring::RankRow> rows;
};

/// Filters for the admin submissions view (any empty field = no filter).
struct SubmissionFilter {
    std::optional<TeamId> teamId;
    std::optional<ChallengeId> challengeId;
    std::optional<SubmitResult> result;
};

class CTFManager {
public:
    /// \param serverSecret HMAC secret for per-team dynamic flags (never hardcoded).
    /// \param dataDir      directory for JSON persistence (created if missing).
    /// \param clock        owned clock; pass a FakeClock in tests.
    CTFManager(std::string serverSecret, std::string dataDir,
               std::unique_ptr<IClock> clock = std::make_unique<SystemClock>());
    ~CTFManager();

    CTFManager(const CTFManager&) = delete;
    CTFManager& operator=(const CTFManager&) = delete;

    // --- persistence -------------------------------------------------------
    void load();       ///< load state from dataDir (no-op if empty)
    void persist();    ///< atomically write current state to dataDir

    // --- auth / session helpers (used by the server middleware) ------------
    std::optional<UserId> userIdForToken(const SessionToken& token) const;
    Role roleOf(const UserId& userId) const;

    // --- auth --------------------------------------------------------------
    AuthOutcome registerUser(const std::string& username, const std::string& email,
                             const std::string& password);
    AuthOutcome login(const std::string& username, const std::string& password);
    void logout(const SessionToken& token);
    MeDto me(const UserId& userId) const;
    MeDto updateProfile(const UserId& userId, const std::optional<std::string>& bio,
                        const std::optional<std::string>& avatarSeed,
                        const std::optional<std::string>& themePrefs);
    UserPublicDto userPublic(const UserId& userId) const;

    // --- teams -------------------------------------------------------------
    TeamDto createTeam(const UserId& userId, const std::string& name);
    TeamDto joinTeam(const UserId& userId, const std::string& inviteCode);
    void leaveTeam(const UserId& userId);
    TeamDto myTeam(const UserId& userId) const;
    TeamDto teamPublic(const TeamId& teamId) const;
    TeamDto kickMember(const UserId& captainId, const UserId& playerId);
    std::string regenerateInvite(const UserId& captainId);

    // --- event state machine (admin) ---------------------------------------
    EventStatusDto eventStatus() const;
    EventStatusDto startEvent(const UserId& adminId);
    EventStatusDto pauseEvent(const UserId& adminId);
    EventStatusDto resumeEvent(const UserId& adminId);
    EventStatusDto endEvent(const UserId& adminId);
    EventStatusDto setFreeze(const UserId& adminId, TimePoint freezeAt);

    // --- challenges (player) -----------------------------------------------
    std::vector<ChallengeListItemDto> listChallenges(const UserId& userId) const;
    ChallengeDetailDto challengeDetail(const UserId& userId, const ChallengeId& challengeId) const;
    SubmitOutcome submitFlag(const UserId& userId, const ChallengeId& challengeId,
                             const std::string& flag);
    HintUnlockOutcome unlockHint(const UserId& userId, const ChallengeId& challengeId,
                                 const HintId& hintId);

    // --- scoreboard / feed / announcements ---------------------------------
    ScoreboardResult publicScoreboard() const;
    std::vector<scoring::RankRow> adminScoreboard(const UserId& adminId) const;
    std::vector<scoring::TeamTimeline> timeline(int topN) const;
    std::vector<events::Event> feedSince(long long sinceId) const;
    long long latestFeedId() const;
    std::vector<Announcement> announcements() const;

    // --- admin -------------------------------------------------------------
    ChallengeDetailDto createChallenge(const UserId& adminId, const ChallengeSpec& spec);
    ChallengeDetailDto editChallenge(const UserId& adminId, const ChallengeId& challengeId,
                                     const ChallengeSpec& spec);
    void deleteChallenge(const UserId& adminId, const ChallengeId& challengeId);
    ChallengeListItemDto setChallengeVisibility(const UserId& adminId,
                                                const ChallengeId& challengeId, bool visible);
    std::vector<SubmissionDto> submissions(const UserId& adminId,
                                           const SubmissionFilter& filter) const;
    std::vector<events::Alert> alerts(const UserId& adminId) const;
    void dismissAlert(const UserId& adminId, const AlertId& alertId);
    /// The behavioural anti-cheat thresholds (0 disables a rule). Admin only; persisted.
    events::AntiCheatConfig antiCheatConfig(const UserId& adminId) const;
    events::AntiCheatConfig setAntiCheatConfig(const UserId& adminId, const events::AntiCheatConfig& config);
    Announcement postAnnouncement(const UserId& adminId, const std::string& title,
                                  const std::string& body, Severity severity);
    std::string revealTeamFlag(const UserId& adminId, const TeamId& teamId,
                               const ChallengeId& challengeId) const;

    /// Aggregate counters for monitoring. Contains no personal data.
    StatsDto stats() const;

    // --- attachments ---------------------------------------------------------
    /// Store (or replace) a file on a challenge; records its size and SHA-256. Admin only.
    /// \p transform is a pipeline such as "flag|xor|hex" (see core/FileTransform.hpp) that
    /// personalises the file per team on download. Empty keeps the existing mode when
    /// replacing a file, or "none" for a new one.
    AttachmentDto addAttachment(const UserId& adminId, const ChallengeId& challengeId,
                                const std::string& name, const std::string& bytes,
                                const std::string& transform = "");
    void removeAttachment(const UserId& adminId, const ChallengeId& challengeId,
                          const std::string& name);
    /// A file for a player or admin. Players need a visible, unlocked challenge and a
    /// running event; the same rules the challenge board applies.
    FileDownload downloadAttachment(const UserId& userId, const ChallengeId& challengeId,
                                    const std::string& name) const;

private:
    // --- internal helpers (assume the appropriate lock is already held) ----
    void requireAdmin(const UserId& userId) const;
    void requireRunning() const;
    const Team& requireTeamOf(const UserId& userId) const;
    Team& requireTeamOfMutable(const UserId& userId);
    int solveCountOf(const ChallengeId& challengeId) const;
    bool frozenNow() const;
    void publishEvent(events::EventType type, std::string message,
                      std::optional<TeamId> teamId = std::nullopt,
                      std::optional<ChallengeId> challengeId = std::nullopt,
                      std::optional<TeamId> otherTeamId = std::nullopt, int points = 0);
    void refreshScoreboard();  ///< recompute the cached live board (unique lock only)
    void persistLocked() const;               ///< write state (assumes lock held)
    EventStatusDto eventStatusLocked() const; ///< build status (assumes lock held)
    ChallengeDetailDto detailForAdmin(const UserId& adminId,
                                      const ChallengeId& challengeId) const;
    nlohmann::json toJson() const;
    void fromJson(const nlohmann::json& doc);

    /// The bytes a given team receives for a personalised attachment (assumes lock held).
    std::string personalise(const Challenge& ch, const Attachment& att, const Team& team,
                            std::string bytes) const;

    // Assemble borrowed views for the Scoreboard under the current lock.
    scoring::TeamView teamView() const;
    scoring::ChallengeView challengeView() const;

    // DTO builders (assume lock held).
    MeDto buildMe(const User& user) const;
    TeamDto buildTeamDto(const Team& team, bool includeInvite) const;
    ChallengeListItemDto buildListItem(const Challenge& ch, const Team* team) const;

    // --- owned state -------------------------------------------------------
    std::string serverSecret_;
    std::string dataDir_;
    persistence::FileStore files_;   // challenge attachments: <dataDir>/files/<challengeId>/<name>
    std::unique_ptr<IClock> clock_;  // declared before members that borrow it

    mutable std::shared_mutex mutex_;

    persistence::Repository<User> users_;
    persistence::Repository<Team> teams_;
    persistence::Repository<Challenge> challenges_;

    std::vector<Submission> submissions_;
    std::vector<Announcement> announcements_;

    events::EventBus bus_;
    std::shared_ptr<events::ActivityFeed> feed_;
    std::shared_ptr<events::EventLog> eventLog_;
    std::shared_ptr<events::AntiCheatMonitor> antiCheat_;
    events::CooldownTracker cooldown_;

    mutable scoring::Scoreboard scoreboard_;
    std::vector<scoring::RankRow> lastLiveBoard_;  ///< cached live board (deltas), unique-lock updated

    app::SessionManager sessions_;

    // event lifecycle
    EventState state_ = EventState::NotStarted;
    std::optional<TimePoint> startAt_;
    std::optional<TimePoint> endAt_;
    std::optional<TimePoint> freezeAt_;
    std::optional<scoring::ScoreboardSnapshot> frozenSnapshot_;

    std::size_t nextTeamNumber_ = 1;
    std::size_t nextUserNumber_ = 1;
    std::size_t nextChallengeNumber_ = 1;
    std::size_t nextSubmissionNumber_ = 1;
    std::size_t nextAnnouncementNumber_ = 1;
};

}  // namespace ctf::app

#endif  // CTF_APP_CTFMANAGER_HPP
