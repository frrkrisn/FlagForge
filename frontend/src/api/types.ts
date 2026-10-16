// TypeScript mirror of docs/api.md. The C++ server is the single source of truth;
// these types describe its JSON responses.

export type Role = 'PLAYER' | 'ADMIN';
export type Category = 'WEB' | 'CRYPTO' | 'FORENSICS' | 'REVERSE' | 'PWN' | 'MISC';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type EventState = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
export type SubmitResult =
  | 'CORRECT'
  | 'WRONG'
  | 'ALREADY_SOLVED'
  | 'LOCKED'
  | 'COOLDOWN'
  | 'CLOSED'
  | 'FLAG_SHARING';

export interface TeamSummary {
  id: string;
  name: string;
  score: number;
  rank: number;
  solves: number;
}

export interface Me {
  id: string;
  username: string;
  email: string;
  role: Role;
  bio: string;
  avatarSeed: string;
  themePrefs: string;
  team: TeamSummary | null;
}

export interface UserPublic {
  id: string;
  username: string;
  role: Role;
  bio: string;
  avatarSeed: string;
  teamId: string | null;
  personalSolves: number;
  badges: string[];
}

export interface TeamMember {
  id: string;
  username: string;
  avatarSeed: string;
  isCaptain: boolean;
  personalSolves: number;
}

export interface Team {
  id: string;
  name: string;
  captainId: string;
  inviteCode?: string;
  members: TeamMember[];
  score: number;
  rank: number;
  solves: number;
  badges: string[];
  solvedChallengeIds: string[];
}

export interface PrereqRef {
  id: string;
  title: string;
  solved: boolean;
}

export interface ChallengeListItem {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  basePoints: number;
  currentPoints: number;
  minPoints: number;
  decay: number;
  solveCount: number;
  solved: boolean;
  locked: boolean;
  missingPrerequisites: { id: string; title: string }[];
  firstBloodByMyTeam: boolean;
  hasHints: boolean;
}

export interface Attachment {
  name: string;
  size: number;
  /** SHA-256 of the file, so players can verify their download. */
  sha256: string;
}

export interface Hint {
  id: string;
  cost: number;
  unlocked: boolean;
  text?: string;
}

export interface ChallengeDetail extends ChallengeListItem {
  description: string;
  attachments: Attachment[];
  recentSolvers: { teamId: string; teamName: string; at: string }[];
  hints: Hint[];
  prerequisites: PrereqRef[];
  scoring: { strategy: string; initial: number; min: number; decay: number; current: number };
}

export interface SubmitOutcome {
  result: SubmitResult;
  awardedPoints?: number;
  firstBlood?: boolean;
  attemptsLeft?: number;
  cooldownSecondsLeft?: number;
  newTeamScore?: number;
}

export interface EventStatus {
  state: EventState;
  startAt: string | null;
  endAt: string | null;
  freezeAt: string | null;
  frozen: boolean;
  serverTime: string;
}

export interface ScoreRow {
  rank: number;
  teamId: string;
  teamName: string;
  avatarSeed: string;
  score: number;
  solves: number;
  lastSolveAt: string;
  categorySolves: Partial<Record<Category, number>>;
  rankDelta: number;
}

export interface Scoreboard {
  frozen: boolean;
  frozenAt: string | null;
  rows: ScoreRow[];
}

export interface TimelineTeam {
  teamId: string;
  teamName: string;
  points: { t: string; score: number }[];
}

export interface FeedEvent {
  type: string;
  at: string;
  message: string;
  teamId?: string;
  challengeId?: string;
  points?: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  at: string;
}

export interface Alert {
  id: string;
  kind: string;
  status: 'OPEN' | 'DISMISSED';
  at: string;
  evidence: string;
  teams: string[];
  challengeId: string | null;
}

export interface AdminSubmission {
  id: string;
  at: string;
  teamName: string;
  playerName: string;
  challengeTitle: string;
  result: SubmitResult;
}
