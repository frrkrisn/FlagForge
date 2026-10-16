import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ChallengeDetail, ChallengeListItem, Me, ScoreRow, SubmitOutcome } from '../api/types';
import { Prompt } from '../components/Panel';
import { cn } from '../lib/cn';
import { execute, HELP, newSession, type Deps, type Line } from '../lib/terminal';

/** Where the simulated nc services live. Override with VITE_CHALLENGE_HOST (e.g. http://10.0.0.5:9001). */
const CHALLENGE_HOST =
  (import.meta.env.VITE_CHALLENGE_HOST as string | undefined) ?? `${window.location.protocol}//${window.location.hostname}:9001`;

async function ncFetch<T>(service: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CHALLENGE_HOST}/nc/${service}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`could not reach the challenge host at ${CHALLENGE_HOST}. Is it running? (node challenge-host/server.mjs)`);
  }
  return (await res.json()) as T;
}

const deps: Deps = {
  whoami: async () => {
    const me = await api.get<Me>('/auth/me');
    return { username: me.username, team: me.team?.name };
  },
  challenges: async () => (await api.get<{ challenges: ChallengeListItem[] }>('/challenges')).challenges,
  detail: (id) => api.get<ChallengeDetail>(`/challenges/${id}`),
  submit: (id, flag) => api.post<SubmitOutcome>(`/challenges/${id}/submit`, { flag }),
  unlockHint: (id, hintId) => api.post(`/challenges/${id}/hints/${hintId}/unlock`),
  scoreboard: async () => (await api.get<{ rows: ScoreRow[] }>('/scoreboard')).rows,
  ncBanner: async (svc) => (await ncFetch<{ banner: string }>(svc)).banner,
  ncSend: async (svc, line) => (await ncFetch<{ output: string }>(svc, { line })).output,
  download: (id, name) => {
    const a = document.createElement('a');
    a.href = `/api/challenges/${id}/files/${encodeURIComponent(name)}`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};

const KIND_CLASS: Record<Line['kind'], string> = {
  out: 'text-fg',
  ok: 'text-accent',
  err: 'text-danger',
  dim: 'text-fg-muted',
};

interface Entry {
  prompt?: string;
  lines: Line[];
}

export default function TerminalPage() {
  const session = useMemo(() => newSession(), []);
  const [entries, setEntries] = useState<Entry[]>([
    { lines: [{ kind: 'dim', text: 'flagforge shell. type `help` for commands.' }] },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries, busy]);

  const submit = async () => {
    const line = input;
    setInput('');
    cursor.current = -1;
    if (line.trim()) history.current.unshift(line);
    const prompt = session.nc ? `${session.nc}>` : '$';

    if (!session.nc && line.trim() === 'clear') {
      setEntries([]);
      return;
    }
    setEntries((e) => [...e, { prompt: `${prompt} ${line}`, lines: [] }]);
    setBusy(true);
    const lines = await execute(line, session, deps);
    setBusy(false);
    if (lines.length) setEntries((e) => [...e, { lines }]);
    inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.current.length) {
      e.preventDefault();
      cursor.current = Math.min(cursor.current + 1, history.current.length - 1);
      setInput(history.current[cursor.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor.current = Math.max(cursor.current - 1, -1);
      setInput(cursor.current === -1 ? '' : history.current[cursor.current]);
    }
  };

  return (
    <div className="space-y-6">
      <Prompt cursor className="text-3xl">
        ssh ctf@flagforge
      </Prompt>
      <p className="text-sm text-fg-muted">
        The whole competition from a command line. Everything here uses the same API as the web pages, so your
        solves, hints and score are real. Try <code className="text-accent">ls</code>,{' '}
        <code className="text-accent">cat 1</code>, or <code className="text-accent">nc overflow</code>.
      </p>

      <div
        className="min-h-[28rem] cursor-text rounded-3xl bg-bg p-6 font-mono text-sm shadow-nm-inset"
        onClick={() => inputRef.current?.focus()}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
      >
        {entries.map((en, i) => (
          <div key={i} className="mb-2">
            {en.prompt && <div className="text-accent">{en.prompt}</div>}
            {en.lines.map((l, j) => (
              <pre key={j} className={cn('whitespace-pre-wrap break-words font-mono', KIND_CLASS[l.kind])}>
                {l.text}
              </pre>
            ))}
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="term-input" className="text-accent">
            {session.nc ? `${session.nc}>` : '$'}
          </label>
          <input
            id="term-input"
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="Command"
            className="flex-1 bg-transparent text-fg caret-accent outline-none"
          />
        </form>
        <div ref={endRef} />
      </div>
      <details className="text-sm text-fg-muted">
        <summary className="cursor-pointer text-fg">Command reference</summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono">{HELP}</pre>
      </details>
    </div>
  );
}
