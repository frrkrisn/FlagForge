import { describe, expect, it } from 'vitest';
import type { TimelineTeam } from '../api/types';
import { movesUpTo, replaySpan, standingsAt } from './replay';

const teams: TimelineTeam[] = [
  { teamId: 'a', teamName: 'Alpha', points: [{ t: '2026-01-01T10:00:00Z', score: 100 }, { t: '2026-01-01T12:00:00Z', score: 250 }] },
  { teamId: 'b', teamName: 'Bravo', points: [{ t: '2026-01-01T11:00:00Z', score: 200 }] },
];
const at = (iso: string) => new Date(iso).getTime();

describe('replay', () => {
  it('finds the span of the data', () => {
    expect(replaySpan(teams)).toEqual({ start: at('2026-01-01T10:00:00Z'), end: at('2026-01-01T12:00:00Z') });
    expect(replaySpan([])).toBeNull();
  });

  it('ranks teams by their score at a moment in time', () => {
    expect(standingsAt(teams, at('2026-01-01T09:00:00Z')).map((r) => r.score)).toEqual([0, 0]);
    expect(standingsAt(teams, at('2026-01-01T10:30:00Z'))[0].teamName).toBe('Alpha');
    expect(standingsAt(teams, at('2026-01-01T11:30:00Z'))[0].teamName).toBe('Bravo');
    expect(standingsAt(teams, at('2026-01-01T12:00:00Z'))[0]).toMatchObject({ teamName: 'Alpha', score: 250 });
  });

  it('lists recent gains newest first and never from the future', () => {
    const m = movesUpTo(teams, at('2026-01-01T11:30:00Z'));
    expect(m.map((x) => [x.teamName, x.gained])).toEqual([['Bravo', 200], ['Alpha', 100]]);
  });
});
