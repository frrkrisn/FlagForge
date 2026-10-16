// The command interpreter behind the in-browser terminal. It is deliberately UI-free: every
// side effect (HTTP calls, file download) arrives through `Deps`, so it can be unit-tested with fakes.

import type { ChallengeDetail, ChallengeListItem, ScoreRow, SubmitOutcome } from '../api/types';

export type LineKind = 'out' | 'ok' | 'err' | 'dim';
export interface Line {
  kind: LineKind;
  text: string;
}

export interface Deps {
  whoami(): Promise<{ username: string; team?: string }>;
  challenges(): Promise<ChallengeListItem[]>;
  detail(id: string): Promise<ChallengeDetail>;
  submit(id: string, flag: string): Promise<SubmitOutcome>;
  unlockHint(id: string, hintId: string): Promise<{ text: string; cost: number; newTeamScore: number }>;
  scoreboard(): Promise<ScoreRow[]>;
  ncBanner(service: string): Promise<string>;
  ncSend(service: string, line: string): Promise<string>;
  download(id: string, name: string): void;
}

export interface Session {
  /** The list from the last `ls`, so `cat 3` means "the third one shown". */
  listed: ChallengeListItem[];
  /** Set while connected to a simulated nc service; the next line goes to it. */
  nc: string | null;
}

export const newSession = (): Session => ({ listed: [], nc: null });

/** Port -> service name, so `nc localhost 9101` works as on a real shell. */
const NC_PORTS: Record<string, string> = { '9101': 'overflow', '9102': 'format', '9103': 'ret2win' };
export const NC_SERVICES = ['overflow', 'format', 'ret2win'];

export const HELP = [
  'commands:',
  '  ls [web|crypto|forensics|reverse|pwn|misc|solved|unsolved]   list challenges',
  '  cat <n|id>                 read a challenge',
  '  files <n|id>               list its files',
  '  get <n|id> <file>          download a file',
  '  submit <n|id> <flag>       submit a flag',
  '  hint <n|id> [hint#]        show or buy a hint (costs points)',
  '  score [n]                  top of the scoreboard',
  '  whoami                     who you are',
  '  nc <service|host port>     connect to a pwn service: overflow, format, ret2win',
  '  clear                      clear the screen',
].join('\n');

/** Split on spaces, keeping "quoted strings" together. */
export function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const L = (kind: LineKind, text: string): Line => ({ kind, text });
const out = (text: string) => [L('out', text)];
const err = (text: string) => [L('err', text)];

async function resolveRef(ref: string | undefined, s: Session, d: Deps): Promise<ChallengeListItem | string> {
  if (!ref) return 'missing challenge: give a number from `ls` or an id like c_3';
  if (s.listed.length === 0) s.listed = await d.challenges();
  if (/^\d+$/.test(ref)) {
    const c = s.listed[Number(ref) - 1];
    return c ?? `no challenge number ${ref} (run \`ls\` first)`;
  }
  const c = s.listed.find((x) => x.id === ref);
  return c ?? `no challenge with id ${ref}`;
}

function fmtList(items: ChallengeListItem[]): string {
  if (items.length === 0) return '(nothing matches)';
  return items
    .map((c, i) => {
      const flag = c.solved ? '[x]' : c.locked ? '[#]' : '[ ]';
      return `${String(i + 1).padStart(2)}. ${flag} ${c.title.padEnd(22)} ${c.category.toLowerCase().padEnd(10)} ${c.difficulty
        .toLowerCase()
        .padEnd(7)} ${String(c.currentPoints).padStart(4)} pts  ${c.id}`;
    })
    .join('\n');
}

/** Run one line of input. Never throws: failures come back as error lines. */
export async function execute(input: string, s: Session, d: Deps): Promise<Line[]> {
  try {
    return await run(input, s, d);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'command failed');
  }
}

async function run(input: string, s: Session, d: Deps): Promise<Line[]> {
  // connected to a service: this line is the payload, then the connection closes
  if (s.nc) {
    const svc = s.nc;
    s.nc = null;
    const reply = await d.ncSend(svc, input);
    return [...out(reply), L('dim', 'connection closed by foreign host')];
  }

  const [cmd, ...args] = tokenize(input);
  if (!cmd) return [];

  switch (cmd) {
    case 'help':
    case '?':
      return out(HELP);

    case 'whoami': {
      const w = await d.whoami();
      return out(`${w.username}${w.team ? ` (team ${w.team})` : ' (no team yet)'}`);
    }

    case 'ls': {
      const all = await d.challenges();
      const f = args[0]?.toLowerCase();
      let list = all;
      if (f === 'solved') list = all.filter((c) => c.solved);
      else if (f === 'unsolved') list = all.filter((c) => !c.solved);
      else if (f) list = all.filter((c) => c.category.toLowerCase() === f);
      s.listed = list;
      return out(fmtList(list));
    }

    case 'cat': {
      const c = await resolveRef(args[0], s, d);
      if (typeof c === 'string') return err(c);
      const det = await d.detail(c.id);
      const lines = [`# ${det.title}  (${det.category.toLowerCase()}, ${det.difficulty.toLowerCase()}, ${det.currentPoints} pts)`, '', det.description];
      if (det.locked) lines.push('', 'LOCKED: solve ' + det.missingPrerequisites.map((p) => p.title).join(', ') + ' first.');
      if (det.writeup) lines.push('', '--- writeup ---', det.writeup);
      return out(lines.join('\n'));
    }

    case 'files': {
      const c = await resolveRef(args[0], s, d);
      if (typeof c === 'string') return err(c);
      const det = await d.detail(c.id);
      if (det.attachments.length === 0) return out('(no files)');
      return out(det.attachments.map((a) => `${a.name}  ${a.size} bytes  sha256 ${a.sha256 || '?'}${a.personalised ? '  (unique to your team)' : ''}`).join('\n'));
    }

    case 'get': {
      const c = await resolveRef(args[0], s, d);
      if (typeof c === 'string') return err(c);
      if (!args[1]) return err('usage: get <n|id> <file>');
      d.download(c.id, args[1]);
      return [L('ok', `downloading ${args[1]} ...`)];
    }

    case 'submit': {
      const c = await resolveRef(args[0], s, d);
      if (typeof c === 'string') return err(c);
      const flag = args.slice(1).join(' ');
      if (!flag) return err('usage: submit <n|id> <flag>');
      const r = await d.submit(c.id, flag);
      switch (r.result) {
        case 'CORRECT':
          return [L('ok', `[+] correct! ${r.awardedPoints ?? 0} points${r.firstBlood ? ' (FIRST BLOOD)' : ''}. team score ${r.newTeamScore ?? '?'}`)];
        case 'WRONG':
          return err(`[-] wrong flag.${r.attemptsLeft !== undefined ? ` ${r.attemptsLeft} attempts left.` : ''}`);
        case 'COOLDOWN':
          return err(`[-] slow down: try again in ${r.cooldownSecondsLeft ?? '?'}s`);
        default:
          return err(`[-] ${r.result.toLowerCase().replace(/_/g, ' ')}`);
      }
    }

    case 'hint': {
      const c = await resolveRef(args[0], s, d);
      if (typeof c === 'string') return err(c);
      const det = await d.detail(c.id);
      if (det.hints.length === 0) return out('(no hints for this challenge)');
      if (!args[1]) {
        return out(
          det.hints.map((h, i) => `hint ${i + 1}: ${h.unlocked ? h.text : `locked, costs ${h.cost} points (run: hint ${args[0]} ${i + 1})`}`).join('\n'),
        );
      }
      const h = det.hints[Number(args[1]) - 1];
      if (!h) return err(`no hint ${args[1]}`);
      if (h.unlocked) return out(h.text ?? '');
      const r = await d.unlockHint(c.id, h.id);
      return [L('ok', `unlocked (-${r.cost} pts): ${r.text}`)];
    }

    case 'score': {
      const n = Math.max(1, Math.min(30, Number(args[0]) || 10));
      const rows = (await d.scoreboard()).slice(0, n);
      return out(rows.map((r) => `${String(r.rank).padStart(2)}. ${r.teamName.padEnd(22)} ${String(r.score).padStart(6)}  ${r.solves} solves`).join('\n'));
    }

    case 'nc': {
      const svc = args.length >= 2 ? NC_PORTS[args[1]] : args[0];
      if (!svc || !NC_SERVICES.includes(svc)) {
        return err(`nc: no service ${args.join(' ') || '(none)'}. Try: ${NC_SERVICES.map((n) => `nc ${n}`).join(', ')}`);
      }
      const banner = await d.ncBanner(svc);
      s.nc = svc;
      return [L('dim', `connected to ${svc}. type your input and press enter.`), ...out(banner)];
    }

    default:
      return err(`${cmd}: command not found. Type \`help\`.`);
  }
}
