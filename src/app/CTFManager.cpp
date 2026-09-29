#include "ctf/app/CTFManager.hpp"

#include <algorithm>
#include <array>
#include <cstdlib>
#include <random>
#include <utility>

#include "ctf/Exceptions.hpp"
#include "ctf/core/ChallengeGraph.hpp"
#include "ctf/core/Crypto.hpp"
#include "ctf/persistence/JsonStore.hpp"

namespace ctf::app {

namespace {

using nlohmann::json;

std::string makeInviteCode() {
    static const char* kAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // no ambiguous chars
    std::random_device rd;
    std::string code;
    for (int i = 0; i < 6; ++i) {
        code.push_back(kAlphabet[rd() % 31]);
    }
    return code;
}

void validateUsername(const std::string& u) {
    if (u.size() < 3 || u.size() > 20) {
        throw ValidationException("Username must be 3–20 characters");
    }
    for (char c : u) {
        const bool ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c == '_' || c == '-';
        if (!ok) {
            throw ValidationException("Username may only contain letters, digits, _ and -");
        }
    }
}

json solveToJson(const SolveRecord& s) {
    return json{{"challengeId", s.challengeId},
                {"playerId", s.playerId},
                {"timestamp", toIso8601(s.timestamp)},
                {"firstBlood", s.firstBlood}};
}

json hintUnlockToJson(const HintUnlock& h) {
    return json{{"challengeId", h.challengeId},
                {"hintId", h.hintId},
                {"cost", h.cost},
                {"timestamp", toIso8601(h.timestamp)}};
}

std::unique_ptr<Challenge> deserializeChallenge(const json& j) {
    const auto id = j.at("id").get<std::string>();
    const auto title = j.at("title").get<std::string>();
    const auto category = categoryFromString(j.at("category").get<std::string>());
    const auto difficulty = difficultyFromString(j.at("difficulty").get<std::string>());
    const int base = j.at("basePoints").get<int>();
    const auto tag = j.value("scoring", std::string("DECAY"));
    auto strategy = ChallengeFactory::makeStrategy(ChallengeFactory::scoringKindFromString(tag));
    const auto flagType = ChallengeFactory::flagTypeFromString(j.at("flagType").get<std::string>());

    std::unique_ptr<Challenge> ch;
    switch (flagType) {
        case FlagType::Static:
            ch = std::make_unique<StaticChallenge>(id, title, category, difficulty, base,
                                                   std::move(strategy),
                                                   j.at("flagHash").get<std::string>());
            break;
        case FlagType::Dynamic:
            ch = std::make_unique<DynamicFlagChallenge>(id, title, category, difficulty, base,
                                                        std::move(strategy),
                                                        j.at("flagPrefix").get<std::string>());
            break;
        case FlagType::Multi:
            ch = std::make_unique<MultiFlagChallenge>(
                id, title, category, difficulty, base, std::move(strategy),
                j.at("flagHashes").get<std::vector<std::string>>());
            break;
    }
    ch->setDescription(j.value("description", ""));
    ch->setScoringParams(j.value("minPoints", base / 5), j.value("decay", 10));
    ch->setScoringTag(tag);
    ch->setVisible(j.value("visible", true));
    ch->setPrerequisites(j.value("prerequisites", std::vector<ChallengeId>{}));
    for (const auto& h : j.value("hints", json::array())) {
        ch->addHint(Hint(h.at("id").get<std::string>(), h.at("text").get<std::string>(),
                         h.at("cost").get<int>()));
    }
    for (const auto& a : j.value("attachments", json::array())) {
        ch->addAttachment(Attachment{a.at("name").get<std::string>(),
                                     a.at("size").get<std::size_t>()});
    }
    return ch;
}

json challengeToJson(const Challenge& ch) {
    json j{{"id", ch.id()},
           {"title", ch.title()},
           {"description", ch.description()},
           {"category", toString(ch.category())},
           {"difficulty", toString(ch.difficulty())},
           {"basePoints", ch.basePoints()},
           {"minPoints", ch.minPoints()},
           {"decay", ch.decay()},
           {"scoring", ch.scoringTag()},
           {"visible", ch.visible()},
           {"flagType", ch.typeTag()},
           {"prerequisites", ch.prerequisites()}};
    json hints = json::array();
    for (const Hint& h : ch.hints()) {
        hints.push_back(json{{"id", h.id()}, {"text", h.text()}, {"cost", h.cost()}});
    }
    j["hints"] = hints;
    json atts = json::array();
    for (const Attachment& a : ch.attachments()) {
        atts.push_back(json{{"name", a.name}, {"size", a.size}});
    }
    j["attachments"] = atts;

    // Persist the material needed to rebuild the challenge (server-side only; hashes,
    // never plaintext flags).
    if (const auto* st = dynamic_cast<const StaticChallenge*>(&ch)) {
        j["flagHash"] = st->flagHash();
    } else if (const auto* dyn = dynamic_cast<const DynamicFlagChallenge*>(&ch)) {
        j["flagPrefix"] = dyn->flagPrefix();
    } else if (const auto* mul = dynamic_cast<const MultiFlagChallenge*>(&ch)) {
        j["flagHashes"] = mul->flagHashes();
    }
    return j;
}

}  // namespace

// ---------------------------------------------------------------------------
// Construction / lifecycle
// ---------------------------------------------------------------------------
CTFManager::CTFManager(std::string serverSecret, std::string dataDir,
                       std::unique_ptr<IClock> clock)
    : serverSecret_(std::move(serverSecret)),
      dataDir_(std::move(dataDir)),
      clock_(std::move(clock)),
      feed_(std::make_shared<events::ActivityFeed>(200)),
      eventLog_(std::make_shared<events::EventLog>()),
      antiCheat_(std::make_shared<events::AntiCheatMonitor>()),
      sessions_(*clock_) {
    bus_.subscribe(feed_);
    bus_.subscribe(eventLog_);
    bus_.subscribe(antiCheat_);
}

CTFManager::~CTFManager() = default;

// ---------------------------------------------------------------------------
// Internal helpers (assume the appropriate lock is held)
// ---------------------------------------------------------------------------
void CTFManager::requireAdmin(const UserId& userId) const {
    const User* u = users_.get(userId);
    if (!u || u->role() != Role::Admin) {
        throw PermissionException("Admin privileges required");
    }
}

void CTFManager::requireRunning() const {
    if (state_ != EventState::Running) {
        throw CompetitionClosedException("The competition is not currently running");
    }
}

const Team& CTFManager::requireTeamOf(const UserId& userId) const {
    const auto* player = dynamic_cast<const Player*>(users_.get(userId));
    if (!player || !player->hasTeam()) {
        throw PermissionException("You must be in a team to do that");
    }
    return teams_.at(player->teamId().value());
}

Team& CTFManager::requireTeamOfMutable(const UserId& userId) {
    auto* player = dynamic_cast<Player*>(users_.get(userId));
    if (!player || !player->hasTeam()) {
        throw PermissionException("You must be in a team to do that");
    }
    return teams_.at(player->teamId().value());
}

int CTFManager::solveCountOf(const ChallengeId& challengeId) const {
    int count = 0;
    for (const Team* t : teams_.all()) {
        if (t && t->hasSolved(challengeId)) {
            ++count;
        }
    }
    return count;
}

bool CTFManager::frozenNow() const {
    return freezeAt_.has_value() && clock_->now() >= *freezeAt_;
}

void CTFManager::publishEvent(events::EventType type, std::string message,
                              std::optional<TeamId> teamId, std::optional<ChallengeId> challengeId,
                              std::optional<TeamId> otherTeamId, int points) {
    events::Event e;
    e.type = type;
    e.timestamp = clock_->now();
    e.teamId = std::move(teamId);
    e.otherTeamId = std::move(otherTeamId);
    e.challengeId = std::move(challengeId);
    e.message = std::move(message);
    e.points = points;
    bus_.publish(e);
}

scoring::TeamView CTFManager::teamView() const {
    scoring::TeamView v;
    for (const Team* t : teams_.all()) v.push_back(t);
    return v;
}

scoring::ChallengeView CTFManager::challengeView() const {
    scoring::ChallengeView v;
    for (const Challenge* c : challenges_.all()) v.push_back(c);
    return v;
}

void CTFManager::refreshScoreboard() {
    lastLiveBoard_ = scoreboard_.compute(teamView(), challengeView(), clock_->now());
}

namespace {
std::vector<ChallengeId> solvedIdsOf(const Team& team) {
    std::vector<ChallengeId> ids;
    for (const SolveRecord& s : team.solves()) ids.push_back(s.challengeId);
    return ids;
}
}  // namespace

// ---------------------------------------------------------------------------
// DTO builders (const; assume a lock is held)
// ---------------------------------------------------------------------------
MeDto CTFManager::buildMe(const User& user) const {
    MeDto me;
    me.id = user.id();
    me.username = user.username();
    me.email = user.email();
    me.role = user.role();
    me.bio = user.bio();
    me.avatarSeed = user.avatarSeed();
    me.themePrefs = user.themePrefs();

    if (const auto* player = dynamic_cast<const Player*>(&user); player && player->hasTeam()) {
        if (const Team* team = teams_.get(player->teamId().value())) {
            TeamSummaryDto sum;
            sum.id = team->id();
            sum.name = team->name();
            const auto snap = scoreboard_.snapshotAt(teamView(), challengeView(), clock_->now());
            for (const auto& row : snap.rows) {
                if (row.teamId == team->id()) {
                    sum.score = row.score;
                    sum.rank = row.rank;
                    sum.solves = row.solves;
                    break;
                }
            }
            me.team = sum;
        }
    }
    return me;
}

TeamDto CTFManager::buildTeamDto(const Team& team, bool includeInvite) const {
    TeamDto d;
    d.id = team.id();
    d.name = team.name();
    d.captainId = team.captainId();
    if (includeInvite) d.inviteCode = team.inviteCode();
    for (const UserId& memberId : team.memberIds()) {
        TeamMemberDto m;
        m.id = memberId;
        m.isCaptain = (memberId == team.captainId());
        if (const auto* p = dynamic_cast<const Player*>(users_.get(memberId))) {
            m.username = p->username();
            m.avatarSeed = p->avatarSeed();
            m.personalSolves = p->personalSolves();
        }
        d.members.push_back(std::move(m));
    }
    const auto snap = scoreboard_.snapshotAt(teamView(), challengeView(), clock_->now());
    for (const auto& row : snap.rows) {
        if (row.teamId == team.id()) {
            d.score = row.score;
            d.rank = row.rank;
            d.solves = row.solves;
            break;
        }
    }
    for (const std::string& b : team.badges()) d.badges.push_back(b);
    d.solvedChallengeIds = solvedIdsOf(team);
    return d;
}

ChallengeListItemDto CTFManager::buildListItem(const Challenge& ch, const Team* team) const {
    ChallengeListItemDto d;
    d.id = ch.id();
    d.title = ch.title();
    d.category = ch.category();
    d.difficulty = ch.difficulty();
    d.basePoints = ch.basePoints();
    d.minPoints = ch.minPoints();
    d.decay = ch.decay();
    d.solveCount = solveCountOf(ch.id());
    d.currentPoints = ch.currentPoints(d.solveCount, false);
    d.hasHints = !ch.hints().empty();

    if (team) {
        d.solved = team->hasSolved(ch.id());
        const auto missing = missingPrerequisites(challengeView(), ch.id(), solvedIdsOf(*team));
        d.locked = !missing.empty();
        for (const ChallengeId& mid : missing) {
            if (const Challenge* mc = challenges_.get(mid)) {
                d.missingPrerequisites.push_back(PrereqRefDto{mid, mc->title(), false});
            }
        }
        for (const SolveRecord& s : team->solves()) {
            if (s.challengeId == ch.id() && s.firstBlood) d.firstBloodByMyTeam = true;
        }
    } else {
        d.locked = !ch.prerequisites().empty();
    }
    return d;
}

// ---------------------------------------------------------------------------
// Auth / session helpers
// ---------------------------------------------------------------------------
std::optional<UserId> CTFManager::userIdForToken(const SessionToken& token) const {
    return sessions_.lookup(token);
}

Role CTFManager::roleOf(const UserId& userId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return users_.at(userId).role();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
AuthOutcome CTFManager::registerUser(const std::string& username, const std::string& email,
                                     const std::string& password) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    validateUsername(username);
    if (email.find('@') == std::string::npos) {
        throw ValidationException("A valid email is required");
    }
    for (const User* u : users_.all()) {
        if (u->username() == username) throw DuplicateSolveException("Username already taken");
        if (u->email() == email) throw DuplicateSolveException("Email already registered");
    }

    const bool firstUser = users_.empty();
    const UserId id = "u_" + std::to_string(nextUserNumber_++);
    std::unique_ptr<User> user =
        firstUser ? std::unique_ptr<User>(std::make_unique<Admin>(id, username, email))
                  : std::unique_ptr<User>(std::make_unique<Player>(id, username, email));
    user->setPassword(password);
    User& ref = *user;
    users_.add(std::move(user));

    const SessionToken token = sessions_.create(id);
    MeDto me = buildMe(ref);
    persistLocked();
    return AuthOutcome{std::move(me), token};
}

AuthOutcome CTFManager::login(const std::string& username, const std::string& password) {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    for (User* u : users_.all()) {
        if (u->username() == username) {
            if (!u->verifyPassword(password)) {
                throw AuthException("Invalid username or password");
            }
            const SessionToken token = sessions_.create(u->id());
            return AuthOutcome{buildMe(*u), token};
        }
    }
    throw AuthException("Invalid username or password");
}

void CTFManager::logout(const SessionToken& token) {
    sessions_.revoke(token);
}

MeDto CTFManager::me(const UserId& userId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return buildMe(users_.at(userId));
}

MeDto CTFManager::updateProfile(const UserId& userId, const std::optional<std::string>& bio,
                                const std::optional<std::string>& avatarSeed,
                                const std::optional<std::string>& themePrefs) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    User& u = users_.at(userId);
    if (bio) u.setBio(*bio);
    if (avatarSeed) u.setAvatarSeed(*avatarSeed);
    if (themePrefs) u.setThemePrefs(*themePrefs);
    persistLocked();
    return buildMe(u);
}

UserPublicDto CTFManager::userPublic(const UserId& userId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    const User& u = users_.at(userId);
    UserPublicDto d;
    d.id = u.id();
    d.username = u.username();
    d.role = u.role();
    d.bio = u.bio();
    d.avatarSeed = u.avatarSeed();
    if (const auto* p = dynamic_cast<const Player*>(&u)) {
        d.teamId = p->teamId();
        d.personalSolves = p->personalSolves();
        if (p->hasTeam()) {
            if (const Team* t = teams_.get(p->teamId().value())) {
                for (const std::string& b : t->badges()) d.badges.push_back(b);
            }
        }
    }
    return d;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
TeamDto CTFManager::createTeam(const UserId& userId, const std::string& name) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    auto* player = dynamic_cast<Player*>(users_.get(userId));
    if (!player) throw PermissionException("Only players can create teams");
    if (player->hasTeam()) throw DuplicateSolveException("You are already in a team");
    if (name.size() < 3 || name.size() > 30) {
        throw ValidationException("Team name must be 3–30 characters");
    }
    for (const Team* t : teams_.all()) {
        if (t->name() == name) throw DuplicateSolveException("Team name already taken");
    }

    const TeamId id = "t_" + std::to_string(nextTeamNumber_++);
    auto team = std::make_unique<Team>(id, name, userId, makeInviteCode());
    Team& ref = *team;
    teams_.add(std::move(team));
    player->joinTeam(id);
    publishEvent(events::EventType::TeamCreated, name + " was created", id);
    refreshScoreboard();
    persistLocked();
    return buildTeamDto(ref, true);
}

TeamDto CTFManager::joinTeam(const UserId& userId, const std::string& inviteCode) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    auto* player = dynamic_cast<Player*>(users_.get(userId));
    if (!player) throw PermissionException("Only players can join teams");
    if (player->hasTeam()) throw DuplicateSolveException("You are already in a team");

    for (Team* t : teams_.all()) {
        if (t->inviteCode() == inviteCode) {
            t->addMember(userId);  // throws TeamFullException if full
            player->joinTeam(t->id());
            publishEvent(events::EventType::TeamJoined, player->username() + " joined " + t->name(),
                         t->id());
            refreshScoreboard();
            persistLocked();
            return buildTeamDto(*t, true);
        }
    }
    throw NotFoundException("No team with that invite code");
}

void CTFManager::leaveTeam(const UserId& userId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    auto* player = dynamic_cast<Player*>(users_.get(userId));
    if (!player || !player->hasTeam()) throw PermissionException("You are not in a team");
    Team& team = teams_.at(player->teamId().value());
    const TeamId teamId = team.id();
    team.removeMember(userId);
    player->leaveTeam();
    if (team.size() == 0) {
        teams_.remove(teamId);
    }
    refreshScoreboard();
    persistLocked();
}

TeamDto CTFManager::myTeam(const UserId& userId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return buildTeamDto(requireTeamOf(userId), true);
}

TeamDto CTFManager::teamPublic(const TeamId& teamId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return buildTeamDto(teams_.at(teamId), false);
}

TeamDto CTFManager::kickMember(const UserId& captainId, const UserId& playerId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    Team& team = requireTeamOfMutable(captainId);
    if (team.captainId() != captainId) throw PermissionException("Only the captain can kick");
    if (playerId == captainId) throw ValidationException("The captain cannot kick themselves");
    team.removeMember(playerId);
    if (auto* p = dynamic_cast<Player*>(users_.get(playerId))) p->leaveTeam();
    persistLocked();
    return buildTeamDto(team, true);
}

std::string CTFManager::regenerateInvite(const UserId& captainId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    Team& team = requireTeamOfMutable(captainId);
    if (team.captainId() != captainId) throw PermissionException("Only the captain can regenerate");
    const std::string code = makeInviteCode();
    team.regenerateInviteCode(code);
    persistLocked();
    return code;
}

// ---------------------------------------------------------------------------
// Event state machine
// ---------------------------------------------------------------------------
EventStatusDto CTFManager::eventStatus() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    EventStatusDto d;
    d.state = state_;
    d.startAt = startAt_;
    d.endAt = endAt_;
    d.freezeAt = freezeAt_;
    d.frozen = frozenNow();
    d.serverTime = clock_->now();
    return d;
}

EventStatusDto CTFManager::startEvent(const UserId& adminId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    if (state_ == EventState::Ended) throw ValidationException("The event has already ended");
    state_ = EventState::Running;
    if (!startAt_) startAt_ = clock_->now();
    publishEvent(events::EventType::EventStarted, "The competition has started");
    persistLocked();
    return eventStatusLocked();
}

EventStatusDto CTFManager::pauseEvent(const UserId& adminId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    if (state_ != EventState::Running) throw ValidationException("The event is not running");
    state_ = EventState::Paused;
    publishEvent(events::EventType::EventPaused, "The competition is paused");
    persistLocked();
    return eventStatusLocked();
}

EventStatusDto CTFManager::resumeEvent(const UserId& adminId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    if (state_ != EventState::Paused) throw ValidationException("The event is not paused");
    state_ = EventState::Running;
    publishEvent(events::EventType::EventResumed, "The competition has resumed");
    persistLocked();
    return eventStatusLocked();
}

EventStatusDto CTFManager::endEvent(const UserId& adminId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    state_ = EventState::Ended;
    endAt_ = clock_->now();
    publishEvent(events::EventType::EventEnded, "The competition has ended");
    persistLocked();
    return eventStatusLocked();
}

EventStatusDto CTFManager::setFreeze(const UserId& adminId, TimePoint freezeAt) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    freezeAt_ = freezeAt;
    persistLocked();
    return eventStatusLocked();
}

EventStatusDto CTFManager::eventStatusLocked() const {
    EventStatusDto d;
    d.state = state_;
    d.startAt = startAt_;
    d.endAt = endAt_;
    d.freezeAt = freezeAt_;
    d.frozen = frozenNow();
    d.serverTime = clock_->now();
    return d;
}

// ---------------------------------------------------------------------------
// Challenges (player)
// ---------------------------------------------------------------------------
std::vector<ChallengeListItemDto> CTFManager::listChallenges(const UserId& userId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    const auto* player = dynamic_cast<const Player*>(users_.get(userId));
    const Team* team =
        (player && player->hasTeam()) ? teams_.get(player->teamId().value()) : nullptr;
    const bool isAdmin = users_.at(userId).role() == Role::Admin;

    std::vector<ChallengeListItemDto> out;
    for (const Challenge* ch : challenges_.all()) {
        if (ch->visible() || isAdmin) {
            out.push_back(buildListItem(*ch, team));
        }
    }
    std::sort(out.begin(), out.end(),
              [](const ChallengeListItemDto& a, const ChallengeListItemDto& b) {
                  return a.id < b.id;
              });
    return out;
}

ChallengeDetailDto CTFManager::challengeDetail(const UserId& userId,
                                               const ChallengeId& challengeId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    const Challenge& ch = challenges_.at(challengeId);
    const bool isAdmin = users_.at(userId).role() == Role::Admin;
    if (!ch.visible() && !isAdmin) throw NotFoundException("No such challenge");

    const auto* player = dynamic_cast<const Player*>(users_.get(userId));
    const Team* team =
        (player && player->hasTeam()) ? teams_.get(player->teamId().value()) : nullptr;

    ChallengeDetailDto d;
    static_cast<ChallengeListItemDto&>(d) = buildListItem(ch, team);
    d.description = ch.description();
    for (const Attachment& a : ch.attachments()) d.attachments.push_back(AttachmentDto{a.name, a.size});

    for (const Hint& h : ch.hints()) {
        HintDto hd;
        hd.id = h.id();
        hd.cost = h.cost();
        hd.unlocked = team && team->hasUnlockedHint(ch.id(), h.id());
        if (hd.unlocked) hd.text = h.text();
        d.hints.push_back(std::move(hd));
    }
    for (const ChallengeId& pid : ch.prerequisites()) {
        if (const Challenge* pc = challenges_.get(pid)) {
            const bool solved = team && team->hasSolved(pid);
            d.prerequisites.push_back(PrereqRefDto{pid, pc->title(), solved});
        }
    }
    // recent solvers (most recent first, up to 5)
    std::vector<SolverDto> solvers;
    for (const Team* t : teams_.all()) {
        for (const SolveRecord& s : t->solves()) {
            if (s.challengeId == ch.id()) solvers.push_back(SolverDto{t->id(), t->name(), s.timestamp});
        }
    }
    std::sort(solvers.begin(), solvers.end(),
              [](const SolverDto& a, const SolverDto& b) { return a.at > b.at; });
    if (solvers.size() > 5) solvers.resize(5);
    d.recentSolvers = std::move(solvers);

    d.scoring = ScoringDto{ch.scoringTag(), ch.basePoints(), ch.minPoints(), ch.decay(),
                           d.currentPoints};
    return d;
}

SubmitOutcome CTFManager::submitFlag(const UserId& userId, const ChallengeId& challengeId,
                                     const std::string& flag) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireRunning();
    Team& team = requireTeamOfMutable(userId);
    const Challenge& ch = challenges_.at(challengeId);
    if (flag.empty()) throw ValidationException("Flag must not be empty");

    const auto missing = missingPrerequisites(challengeView(), challengeId, solvedIdsOf(team));
    if (!missing.empty()) throw ChallengeLockedException("Solve the prerequisites first");

    const TimePoint now = clock_->now();
    int secondsLeft = 0;
    if (cooldown_.isOnCooldown(team.id(), challengeId, now, secondsLeft)) {
        throw CooldownException("Too many wrong attempts; wait before retrying", secondsLeft);
    }
    if (team.hasSolved(challengeId)) {
        return SubmitOutcome{SubmitResult::AlreadySolved, {}, {}, {}, {}, {}};
    }

    const FlagCheckContext ctx{team.id(), serverSecret_};
    const bool correct = ch.checkFlag(ctx, flag);

    if (correct) {
        const bool firstBlood = solveCountOf(challengeId) == 0;
        team.recordSolve(SolveRecord{challengeId, userId, now, firstBlood});
        if (auto* p = dynamic_cast<Player*>(users_.get(userId))) p->incrementSolves();
        cooldown_.clear(team.id(), challengeId);

        submissions_.push_back(Submission(team.id(), userId, challengeId, now, SubmitResult::Correct));
        if (firstBlood) {
            team.awardBadge("FIRST_BLOOD");
            publishEvent(events::EventType::FirstBlood,
                         team.name() + " drew first blood on " + ch.title(), team.id(), challengeId);
        }
        const int awarded = ch.currentPoints(solveCountOf(challengeId), firstBlood);
        publishEvent(events::EventType::Solve, team.name() + " solved " + ch.title(), team.id(),
                     challengeId, std::nullopt, awarded);
        refreshScoreboard();
        const int newScore = scoreboard_.scoreOf(team, teamView(), challengeView(), now);
        persistLocked();

        SubmitOutcome out;
        out.result = SubmitResult::Correct;
        out.awardedPoints = awarded;
        out.firstBlood = firstBlood;
        out.newTeamScore = newScore;
        return out;
    }

    // Wrong: is it another team's dynamic flag (sharing)?
    if (const auto* dyn = dynamic_cast<const DynamicFlagChallenge*>(&ch)) {
        for (const Team* other : teams_.all()) {
            if (other->id() == team.id()) continue;
            if (crypto::constantTimeEquals(flag, dyn->expectedFlagFor(other->id(), serverSecret_))) {
                submissions_.push_back(
                    Submission(team.id(), userId, challengeId, now, SubmitResult::FlagSharing));
                publishEvent(events::EventType::FlagSharing,
                             team.name() + " submitted " + other->name() + "'s flag for " +
                                 ch.title(),
                             team.id(), challengeId, other->id());
                persistLocked();
                SubmitOutcome out;
                out.result = SubmitResult::FlagSharing;
                return out;
            }
        }
    }

    // Genuinely wrong.
    const bool triggered = cooldown_.recordWrong(team.id(), challengeId, now);
    antiCheat_->noteWrongFlag(team.id(), challengeId, crypto::sha256Hex(flag), now);
    submissions_.push_back(Submission(team.id(), userId, challengeId, now, SubmitResult::Wrong));
    publishEvent(events::EventType::WrongAttempt, team.name() + " missed on " + ch.title(),
                 team.id(), challengeId);
    if (triggered) {
        publishEvent(events::EventType::CooldownTriggered,
                     team.name() + " is on cooldown for " + ch.title(), team.id(), challengeId);
    }
    persistLocked();

    SubmitOutcome out;
    out.result = SubmitResult::Wrong;
    const int used = cooldown_.recentWrongCount(team.id(), challengeId, now);
    out.attemptsLeft = triggered ? 0 : std::max(0, events::CooldownTracker::kMaxWrong - used);
    if (triggered) {
        out.cooldownSecondsLeft =
            static_cast<int>(events::CooldownTracker::kCooldown.count());
    }
    return out;
}

HintUnlockOutcome CTFManager::unlockHint(const UserId& userId, const ChallengeId& challengeId,
                                         const HintId& hintId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireRunning();
    Team& team = requireTeamOfMutable(userId);
    const Challenge& ch = challenges_.at(challengeId);
    const Hint* hint = ch.findHint(hintId);
    if (!hint) throw NotFoundException("No such hint");

    const auto missing = missingPrerequisites(challengeView(), challengeId, solvedIdsOf(team));
    if (!missing.empty()) throw ChallengeLockedException("Solve the prerequisites first");

    const TimePoint now = clock_->now();
    team.recordHintUnlock(HintUnlock{challengeId, hintId, hint->cost(), now});
    publishEvent(events::EventType::HintUnlocked, team.name() + " unlocked a hint on " + ch.title(),
                 team.id(), challengeId);
    refreshScoreboard();
    const int newScore = scoreboard_.scoreOf(team, teamView(), challengeView(), now);
    persistLocked();

    return HintUnlockOutcome{hintId, hint->text(), hint->cost(), newScore};
}

// ---------------------------------------------------------------------------
// Scoreboard / feed / announcements
// ---------------------------------------------------------------------------
ScoreboardResult CTFManager::publicScoreboard() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    ScoreboardResult r;
    if (frozenNow()) {
        r.frozen = true;
        r.frozenAt = freezeAt_;
        r.rows = scoreboard_.snapshotAt(teamView(), challengeView(), *freezeAt_).rows;
    } else {
        r.rows = lastLiveBoard_.empty()
                     ? scoreboard_.snapshotAt(teamView(), challengeView(), clock_->now()).rows
                     : lastLiveBoard_;
    }
    return r;
}

std::vector<scoring::RankRow> CTFManager::adminScoreboard(const UserId& adminId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    return lastLiveBoard_.empty()
               ? scoreboard_.snapshotAt(teamView(), challengeView(), clock_->now()).rows
               : lastLiveBoard_;
}

std::vector<scoring::TeamTimeline> CTFManager::timeline(int topN) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    const TimePoint at = frozenNow() ? *freezeAt_ : clock_->now();
    return scoreboard_.timeline(teamView(), challengeView(), topN, at);
}

std::vector<events::Event> CTFManager::feedSince(long long sinceId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return feed_->since(sinceId);
}

long long CTFManager::latestFeedId() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return feed_->latestId();
}

std::vector<Announcement> CTFManager::announcements() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    std::vector<Announcement> out(announcements_.rbegin(), announcements_.rend());  // newest first
    return out;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
ChallengeDetailDto CTFManager::createChallenge(const UserId& adminId, const ChallengeSpec& spec) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    // Assign a persistence-stable id here (Challenge's static counter resets per
    // process and would collide with loaded challenges after a restart).
    ChallengeSpec s = spec;
    if (s.id.empty()) s.id = "c_" + std::to_string(nextChallengeNumber_++);
    auto challenge = ChallengeFactory::create(s);
    const ChallengeId id = challenge->id();
    challenges_.add(std::move(challenge));
    try {
        validatePrerequisiteGraph(challengeView());
    } catch (...) {
        challenges_.remove(id);
        throw;
    }
    refreshScoreboard();
    persistLocked();
    return detailForAdmin(adminId, id);
}

ChallengeDetailDto CTFManager::editChallenge(const UserId& adminId, const ChallengeId& challengeId,
                                             const ChallengeSpec& spec) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    if (!challenges_.contains(challengeId)) throw NotFoundException("No such challenge");
    ChallengeSpec s = spec;
    s.id = challengeId;
    auto rebuilt = ChallengeFactory::create(s);
    challenges_.add(std::move(rebuilt));  // replaces existing (same key)
    try {
        validatePrerequisiteGraph(challengeView());
    } catch (...) {
        throw;
    }
    refreshScoreboard();
    persistLocked();
    return detailForAdmin(adminId, challengeId);
}

void CTFManager::deleteChallenge(const UserId& adminId, const ChallengeId& challengeId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    if (!challenges_.remove(challengeId)) throw NotFoundException("No such challenge");
    refreshScoreboard();
    persistLocked();
}

ChallengeListItemDto CTFManager::setChallengeVisibility(const UserId& adminId,
                                                        const ChallengeId& challengeId,
                                                        bool visible) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    Challenge& ch = challenges_.at(challengeId);
    ch.setVisible(visible);
    persistLocked();
    return buildListItem(ch, nullptr);
}

std::vector<SubmissionDto> CTFManager::submissions(const UserId& adminId,
                                                   const SubmissionFilter& filter) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    std::vector<SubmissionDto> out;
    std::size_t n = 0;
    for (const Submission& s : submissions_) {
        if (filter.teamId && s.teamId() != *filter.teamId) continue;
        if (filter.challengeId && s.challengeId() != *filter.challengeId) continue;
        if (filter.result && s.result() != *filter.result) continue;
        SubmissionDto d;
        d.id = "s_" + std::to_string(n++);
        d.at = s.timestamp();
        if (const Team* t = teams_.get(s.teamId())) d.teamName = t->name();
        if (const User* u = users_.get(s.playerId())) d.playerName = u->username();
        if (const Challenge* c = challenges_.get(s.challengeId())) d.challengeTitle = c->title();
        d.result = s.result();
        out.push_back(std::move(d));
    }
    return out;
}

std::vector<events::Alert> CTFManager::alerts(const UserId& adminId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    return antiCheat_->alerts();
}

void CTFManager::dismissAlert(const UserId& adminId, const AlertId& alertId) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    antiCheat_->dismiss(alertId);
}

Announcement CTFManager::postAnnouncement(const UserId& adminId, const std::string& title,
                                          const std::string& body, Severity severity) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    Announcement a;
    a.id = "a_" + std::to_string(nextAnnouncementNumber_++);
    a.title = title;
    a.body = body;
    a.severity = severity;
    a.timestamp = clock_->now();
    announcements_.push_back(a);
    publishEvent(events::EventType::Announcement, title);
    persistLocked();
    return a;
}

std::string CTFManager::revealTeamFlag(const UserId& adminId, const TeamId& teamId,
                                       const ChallengeId& challengeId) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    requireAdmin(adminId);
    if (!teams_.contains(teamId)) throw NotFoundException("No such team");
    const Challenge& ch = challenges_.at(challengeId);
    if (const auto* dyn = dynamic_cast<const DynamicFlagChallenge*>(&ch)) {
        return dyn->expectedFlagFor(teamId, serverSecret_);
    }
    throw ValidationException("That challenge does not use per-team dynamic flags");
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
void CTFManager::persist() {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    persistLocked();
}

void CTFManager::persistLocked() const {
    persistence::JsonStore store(dataDir_ + "/state.json");
    store.save(toJson());
}

void CTFManager::load() {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    persistence::JsonStore store(dataDir_ + "/state.json");
    if (!store.exists()) return;
    fromJson(store.load());
    refreshScoreboard();
}

nlohmann::json CTFManager::toJson() const {
    json doc;
    doc["schemaVersion"] = persistence::JsonStore::kSchemaVersion;
    doc["event"] = json{{"state", toString(state_)},
                        {"startAt", startAt_ ? json(toIso8601(*startAt_)) : json(nullptr)},
                        {"endAt", endAt_ ? json(toIso8601(*endAt_)) : json(nullptr)},
                        {"freezeAt", freezeAt_ ? json(toIso8601(*freezeAt_)) : json(nullptr)}};
    doc["counters"] = json{{"user", nextUserNumber_},
                           {"team", nextTeamNumber_},
                           {"challenge", nextChallengeNumber_},
                           {"submission", nextSubmissionNumber_},
                           {"announcement", nextAnnouncementNumber_}};

    json users = json::array();
    for (const User* u : users_.all()) {
        json ju{{"id", u->id()},         {"username", u->username()},
                {"email", u->email()},   {"role", toString(u->role())},
                {"bio", u->bio()},       {"avatarSeed", u->avatarSeed()},
                {"themePrefs", u->themePrefs()}, {"salt", u->salt()},
                {"passwordHash", u->passwordHash()}};
        if (const auto* p = dynamic_cast<const Player*>(u)) {
            ju["teamId"] = p->hasTeam() ? json(p->teamId().value()) : json(nullptr);
            ju["personalSolves"] = p->personalSolves();
        }
        users.push_back(std::move(ju));
    }
    doc["users"] = std::move(users);

    json teams = json::array();
    for (const Team* t : teams_.all()) {
        json solves = json::array();
        for (const SolveRecord& s : t->solves()) solves.push_back(solveToJson(s));
        json hus = json::array();
        for (const HintUnlock& h : t->hintUnlocks()) hus.push_back(hintUnlockToJson(h));
        json badges = json::array();
        for (const std::string& b : t->badges()) badges.push_back(b);
        teams.push_back(json{{"id", t->id()},
                             {"name", t->name()},
                             {"captainId", t->captainId()},
                             {"inviteCode", t->inviteCode()},
                             {"memberIds", t->memberIds()},
                             {"solves", solves},
                             {"hintUnlocks", hus},
                             {"badges", badges}});
    }
    doc["teams"] = std::move(teams);

    json chs = json::array();
    for (const Challenge* c : challenges_.all()) chs.push_back(challengeToJson(*c));
    doc["challenges"] = std::move(chs);

    json subs = json::array();
    for (const Submission& s : submissions_) {
        subs.push_back(json{{"teamId", s.teamId()},
                            {"playerId", s.playerId()},
                            {"challengeId", s.challengeId()},
                            {"timestamp", toIso8601(s.timestamp())},
                            {"result", toString(s.result())}});
    }
    doc["submissions"] = std::move(subs);

    json anns = json::array();
    for (const Announcement& a : announcements_) {
        anns.push_back(json{{"id", a.id},
                            {"title", a.title},
                            {"body", a.body},
                            {"severity", toString(a.severity)},
                            {"timestamp", toIso8601(a.timestamp)}});
    }
    doc["announcements"] = std::move(anns);
    return doc;
}

void CTFManager::fromJson(const nlohmann::json& doc) {
    users_.clear();
    teams_.clear();
    challenges_.clear();
    submissions_.clear();
    announcements_.clear();

    const json counters = doc.value("counters", json::object());
    nextUserNumber_ = counters.value("user", static_cast<std::size_t>(1));
    nextTeamNumber_ = counters.value("team", static_cast<std::size_t>(1));
    nextChallengeNumber_ = counters.value("challenge", static_cast<std::size_t>(1));
    nextSubmissionNumber_ = counters.value("submission", static_cast<std::size_t>(1));
    nextAnnouncementNumber_ = counters.value("announcement", static_cast<std::size_t>(1));

    if (doc.contains("event")) {
        const json& e = doc["event"];
        const std::string st = e.value("state", std::string("NOT_STARTED"));
        state_ = st == "RUNNING"  ? EventState::Running
                 : st == "PAUSED" ? EventState::Paused
                 : st == "ENDED"  ? EventState::Ended
                                  : EventState::NotStarted;
        auto readTime = [&](const char* key) -> std::optional<TimePoint> {
            if (e.contains(key) && !e[key].is_null()) {
                return fromIso8601(e[key].get<std::string>());
            }
            return std::nullopt;
        };
        startAt_ = readTime("startAt");
        endAt_ = readTime("endAt");
        freezeAt_ = readTime("freezeAt");
    }

    for (const json& ju : doc.value("users", json::array())) {
        const auto id = ju.at("id").get<std::string>();
        const auto username = ju.at("username").get<std::string>();
        const auto email = ju.value("email", std::string());
        const Role role = roleFromString(ju.at("role").get<std::string>());
        std::unique_ptr<User> u = (role == Role::Admin)
                                      ? std::unique_ptr<User>(std::make_unique<Admin>(id, username, email))
                                      : std::unique_ptr<User>(std::make_unique<Player>(id, username, email));
        u->setBio(ju.value("bio", std::string()));
        u->setAvatarSeed(ju.value("avatarSeed", username));
        u->setThemePrefs(ju.value("themePrefs", std::string()));
        u->restoreCredential(ju.value("salt", std::string()), ju.value("passwordHash", std::string()));
        if (auto* p = dynamic_cast<Player*>(u.get())) {
            if (ju.contains("teamId") && !ju["teamId"].is_null()) {
                p->joinTeam(ju["teamId"].get<std::string>());
            }
            p->setPersonalSolves(ju.value("personalSolves", 0));
        }
        users_.add(std::move(u));
    }

    for (const json& jt : doc.value("teams", json::array())) {
        auto team = std::make_unique<Team>(jt.at("id").get<std::string>(),
                                           jt.at("name").get<std::string>(),
                                           jt.at("captainId").get<std::string>(),
                                           jt.at("inviteCode").get<std::string>());
        for (const auto& mid : jt.value("memberIds", std::vector<std::string>{})) {
            if (mid != team->captainId()) team->addMember(mid);
        }
        for (const json& js : jt.value("solves", json::array())) {
            team->recordSolve(SolveRecord{js.at("challengeId").get<std::string>(),
                                          js.at("playerId").get<std::string>(),
                                          fromIso8601(js.at("timestamp").get<std::string>()),
                                          js.value("firstBlood", false)});
        }
        for (const json& jh : jt.value("hintUnlocks", json::array())) {
            team->recordHintUnlock(HintUnlock{jh.at("challengeId").get<std::string>(),
                                              jh.at("hintId").get<std::string>(),
                                              jh.at("cost").get<int>(),
                                              fromIso8601(jh.at("timestamp").get<std::string>())});
        }
        for (const auto& b : jt.value("badges", std::vector<std::string>{})) {
            team->awardBadge(b);
        }
        teams_.add(std::move(team));
    }

    for (const json& jc : doc.value("challenges", json::array())) {
        challenges_.add(deserializeChallenge(jc));
    }
    // Safety net: never re-issue an existing "c_N" id after a restart.
    for (const Challenge* c : challenges_.all()) {
        if (c && c->id().rfind("c_", 0) == 0) {
            const std::size_t n = std::strtoul(c->id().c_str() + 2, nullptr, 10);
            nextChallengeNumber_ = std::max(nextChallengeNumber_, n + 1);
        }
    }

    for (const json& js : doc.value("submissions", json::array())) {
        submissions_.push_back(Submission(js.at("teamId").get<std::string>(),
                                          js.at("playerId").get<std::string>(),
                                          js.at("challengeId").get<std::string>(),
                                          fromIso8601(js.at("timestamp").get<std::string>()),
                                          submitResultFromString(js.at("result").get<std::string>())));
    }

    for (const json& ja : doc.value("announcements", json::array())) {
        Announcement a;
        a.id = ja.at("id").get<std::string>();
        a.title = ja.value("title", std::string());
        a.body = ja.value("body", std::string());
        a.severity = severityFromString(ja.value("severity", std::string("INFO")));
        a.timestamp = fromIso8601(ja.at("timestamp").get<std::string>());
        announcements_.push_back(std::move(a));
    }
}

ChallengeDetailDto CTFManager::detailForAdmin(const UserId& adminId,
                                              const ChallengeId& challengeId) const {
    // Admin detail view (no team context). Assumes lock held.
    const Challenge& ch = challenges_.at(challengeId);
    ChallengeDetailDto d;
    static_cast<ChallengeListItemDto&>(d) = buildListItem(ch, nullptr);
    d.description = ch.description();
    for (const Attachment& a : ch.attachments()) d.attachments.push_back(AttachmentDto{a.name, a.size});
    for (const Hint& h : ch.hints()) {
        HintDto hd;
        hd.id = h.id();
        hd.cost = h.cost();
        hd.unlocked = true;  // admins see hint text
        hd.text = h.text();
        d.hints.push_back(std::move(hd));
    }
    for (const ChallengeId& pid : ch.prerequisites()) {
        if (const Challenge* pc = challenges_.get(pid)) {
            d.prerequisites.push_back(PrereqRefDto{pid, pc->title(), false});
        }
    }
    d.scoring = ScoringDto{ch.scoringTag(), ch.basePoints(), ch.minPoints(), ch.decay(),
                           d.currentPoints};
    (void)adminId;
    return d;
}

}  // namespace ctf::app
