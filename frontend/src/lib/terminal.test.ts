import { describe, expect, it, vi } from 'vitest';
import type { ChallengeDetail, ChallengeListItem } from '../api/types';
import { execute, newSession, tokenize, type Deps } from './terminal';

const item = (id: string, title: string, over: Partial<ChallengeListItem> = {}): ChallengeListItem => ({
  id,
  title,
  category: 'WEB',
  difficulty: 'EASY',
  basePoints: 100,
  currentPoints: 90,
  minPoints: 20,
  decay: 10,
  solveCount: 0,
  solved: false,
  locked: false,
  missingPrerequisites: [],
  prerequisiteIds: [],
  firstBloodByMyTeam: false,
  hasHints: false,
  ...over,
});

function deps(over: Partial<Deps> = {}): Deps {
  return {
    whoami: async () => ({ username: 'neo', team: 'Matrix' }),
    challenges: async () => [item('c_1', 'Inspect Me'), item('c_2', 'Cookie', { category: 'CRYPTO', solved: true })],
    detail: async (id) =>
      ({ ...item(id, 'Inspect Me'), description: 'look closer', attachments: [], hints: [{ id: 'h_1', cost: 30, unlocked: false }], recentSolvers: [], prerequisites: [], scoring: {} }) as unknown as ChallengeDetail,
    submit: async () => ({ result: 'CORRECT', awardedPoints: 90, newTeamScore: 90 }),
    unlockHint: async () => ({ text: 'view source', cost: 30, newTeamScore: 60 }),
    scoreboard: async () => [{ rank: 1, teamName: 'Matrix', score: 90, solves: 1 }] as never,
    ncBanner: async () => 'BANNER',
    ncSend: async (_s, line) => `echo:${line}`,
    download: vi.fn(),
    ...over,
  };
}

const text = (lines: { text: string }[]) => lines.map((l) => l.text).join('\n');

describe('tokenize', () => {
  it('keeps quoted strings together', () => {
    expect(tokenize('submit 1 "CTF{a b}"')).toEqual(['submit', '1', 'CTF{a b}']);
    expect(tokenize('  ls   web ')).toEqual(['ls', 'web']);
  });
});

describe('terminal commands', () => {
  it('lists challenges and filters by category or status', async () => {
    const s = newSession();
    const all = await execute('ls', s, deps());
    expect(text(all)).toContain('Inspect Me');
    expect(text(all)).toContain('[x]');
    expect(text(await execute('ls crypto', s, deps()))).not.toContain('Inspect Me');
    expect(text(await execute('ls unsolved', s, deps()))).not.toContain('Cookie');
  });

  it('refers to challenges by the number shown in the last ls', async () => {
    const s = newSession();
    await execute('ls crypto', s, deps());
    const submit = vi.fn(async () => ({ result: 'CORRECT' as const, awardedPoints: 5, newTeamScore: 5 }));
    await execute('submit 1 CTF{x}', s, deps({ submit }));
    expect(submit).toHaveBeenCalledWith('c_2', 'CTF{x}');
  });

  it('reports wrong flags, cooldowns and unknown refs as errors', async () => {
    const s = newSession();
    const wrong = await execute('submit c_1 nope', s, deps({ submit: async () => ({ result: 'WRONG', attemptsLeft: 4 }) }));
    expect(wrong[0].kind).toBe('err');
    expect(wrong[0].text).toContain('4 attempts left');
    const bad = await execute('cat 99', s, deps());
    expect(bad[0].kind).toBe('err');
    expect((await execute('frobnicate', s, deps()))[0].text).toContain('command not found');
  });

  it('shows hints locked, then buys one on request', async () => {
    const s = newSession();
    expect(text(await execute('hint c_1', s, deps()))).toContain('costs 30 points');
    expect(text(await execute('hint c_1 1', s, deps()))).toContain('view source');
  });

  it('never throws: API failures become error lines', async () => {
    const lines = await execute('score', newSession(), deps({ scoreboard: async () => { throw new Error('boom'); } }));
    expect(lines).toEqual([{ kind: 'err', text: 'boom' }]);
  });

  it('connects to an nc service, sends one line, then disconnects', async () => {
    const s = newSession();
    const hello = await execute('nc overflow', s, deps());
    expect(text(hello)).toContain('BANNER');
    expect(s.nc).toBe('overflow');
    const reply = await execute('AAAA', s, deps());
    expect(text(reply)).toContain('echo:AAAA');
    expect(s.nc).toBeNull();
    // host + port form, as on a real shell
    await execute('nc localhost 9103', s, deps());
    expect(s.nc).toBe('ret2win');
    expect((await execute('nc nowhere', newSession(), deps()))[0].kind).toBe('err');
  });

  it('downloads a file by name', async () => {
    const download = vi.fn();
    await execute('get c_1 notes.txt', newSession(), deps({ download }));
    expect(download).toHaveBeenCalledWith('c_1', 'notes.txt');
  });
});
