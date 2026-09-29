import { ArrowRight, Flag, Trophy, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useChallenges, useEventStatus, useScoreboard } from '../api/hooks';
import { Countdown } from '../components/domain';
import { AsciiWordmark } from '../components/Logo';
import { Panel } from '../components/Panel';
import { TeamAvatar } from '../components/TeamAvatar';
import { Button, Skeleton } from '../components/ui';

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-panel p-4">
      <span className="text-accent">{icon}</span>
      <div>
        <div className="font-mono text-2xl tabular-nums text-fg">{value}</div>
        <div className="text-xs uppercase tracking-wider text-fg-muted">{label}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { data: status } = useEventStatus();
  const { data: board } = useScoreboard();
  const { data: challenges } = useChallenges();

  const totalSolves = (board?.rows ?? []).reduce((n, r) => n + r.solves, 0);

  return (
    <div className="space-y-10">
      <section className="flex flex-col items-center gap-6 py-10 text-center">
        <AsciiWordmark className="text-[10px] sm:text-sm" />
        <p className="max-w-xl text-fg-muted">
          A Capture-The-Flag competition platform. Register a team, break challenges, submit flags, and climb a live leaderboard with dynamic scoring, first blood and costed hints.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/challenges">
            <Button>
              Enter the arena <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/scoreboard">
            <Button variant="outline">View scoreboard</Button>
          </Link>
        </div>
        {status && (
          <div className="rounded border border-border px-4 py-2 text-sm">
            {status.state === 'RUNNING' ? (
              <span className="text-success">
                ● LIVE {status.endAt && <>· ends in <Countdown target={status.endAt} serverNow={status.serverTime} /></>}
              </span>
            ) : status.state === 'NOT_STARTED' && status.startAt ? (
              <span className="text-fg-muted">
                starts in <Countdown target={status.startAt} serverNow={status.serverTime} />
              </span>
            ) : (
              <span className="text-fg-muted">{status.state.replace('_', ' ').toLowerCase()}</span>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Users size={22} />} label="Teams" value={board?.rows.length ?? '—'} />
        <Stat icon={<Flag size={22} />} label="Challenges" value={challenges?.length ?? '—'} />
        <Stat icon={<Trophy size={22} />} label="Total solves" value={totalSolves} />
      </section>

      <section>
        <Panel title="~/scoreboard/top5">
          {!board ? (
            <Skeleton className="h-40" />
          ) : board.rows.length === 0 ? (
            <p className="text-sm text-fg-muted">No teams on the board yet — be the first.</p>
          ) : (
            <ol className="space-y-2">
              {board.rows.slice(0, 5).map((r) => (
                <li key={r.teamId} className="flex items-center gap-3">
                  <span className="w-6 text-center font-mono text-fg-muted">{r.rank}</span>
                  <TeamAvatar seed={r.avatarSeed} size={24} />
                  <Link to={`/teams/${r.teamId}`} className="font-mono text-fg hover:text-accent">
                    {r.teamName}
                  </Link>
                  <span className="ml-auto font-mono tabular-nums text-accent">{r.score}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['01 Register', 'Create an account and form a team of up to four.'],
          ['02 Solve', 'Work through categories from Web to Pwn and submit CTF{...} flags.'],
          ['03 Climb', 'Score rises with each solve; points decay as others catch up. Draw first blood for a bonus.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-border bg-panel p-4">
            <div className="font-mono text-accent">{t}</div>
            <div className="mt-1 text-sm text-fg-muted">{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
