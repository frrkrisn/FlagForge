import type { TimelineTeam } from '../api/types';

export interface ReplayRow {
  teamId: string;
  teamName: string;
  score: number;
}

export interface ReplayMove {
  at: number;
  teamName: string;
  gained: number;
}

/** First and last timestamp across all teams (ms), or null with no data. */
export function replaySpan(teams: TimelineTeam[]): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  for (const t of teams) {
    for (const p of t.points) {
      const ms = new Date(p.t).getTime();
      if (ms < start) start = ms;
      if (ms > end) end = ms;
    }
  }
  return start === Infinity ? null : { start, end };
}

/** Every team score at the moment `at` (ms), best first. A team with no point yet is on 0. */
export function standingsAt(teams: TimelineTeam[], at: number): ReplayRow[] {
  return teams
    .map((t) => {
      let score = 0;
      for (const p of t.points) {
        if (new Date(p.t).getTime() <= at) score = p.score;
      }
      return { teamId: t.teamId, teamName: t.teamName, score };
    })
    .sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName));
}

/** The most recent score gains at or before `at`, newest first. */
export function movesUpTo(teams: TimelineTeam[], at: number, limit = 8): ReplayMove[] {
  const moves: ReplayMove[] = [];
  for (const t of teams) {
    let prev = 0;
    for (const p of t.points) {
      const ms = new Date(p.t).getTime();
      if (p.score !== prev && ms <= at) moves.push({ at: ms, teamName: t.teamName, gained: p.score - prev });
      prev = p.score;
    }
  }
  return moves.sort((a, b) => b.at - a.at).slice(0, limit);
}
