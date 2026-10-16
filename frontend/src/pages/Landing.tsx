import { ArrowRight, Flag, ScrollText, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChallenges, useEventStatus, useScoreboard } from '../api/hooks';
import { Countdown } from '../components/domain';
import { Dial, SignalBars } from '../components/Dial';
import { AsciiWordmark } from '../components/Logo';
import { CountUp, Reveal } from '../components/motion';
import { Panel } from '../components/Panel';
import { TeamAvatar } from '../components/TeamAvatar';
import { Button, Skeleton } from '../components/ui';

const SHORTCUTS = [
  { to: '/challenges', label: 'Challenges', icon: Flag },
  { to: '/scoreboard', label: 'Scoreboard', icon: Trophy },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/rules', label: 'Rules', icon: ScrollText },
];

function MiniStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl bg-bg px-5 py-4 shadow-nm-inset-sm">
      <div className="font-mono text-2xl tabular-nums text-fg">
        {value === undefined ? '—' : <CountUp value={value} />}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</div>
    </div>
  );
}

export default function Landing() {
  const { data: status } = useEventStatus();
  const { data: board } = useScoreboard();
  const { data: challenges } = useChallenges();

  const rows = board?.rows ?? [];
  const teamCount = rows.length;
  const totalSolves = rows.reduce((n, r) => n + r.solves, 0);
  const scoringTeams = rows.filter((r) => r.solves > 0).length;
  // Display-only ratios of numbers the server already returned.
  const scoringPct = teamCount ? (scoringTeams / teamCount) * 100 : 0;
  const activity = teamCount ? Math.min(7, (totalSolves / (teamCount * 4)) * 7) : 0;

  return (
    <div className="space-y-14">
      <section className="flex flex-col items-center gap-8 py-10 text-center">
        <AsciiWordmark className="w-[min(86vw,38rem)]" />
        <p className="max-w-xl text-fg-muted">
          A Capture-The-Flag competition platform. Register a team, break challenges, submit flags, and climb a live
          leaderboard with dynamic scoring, first blood and costed hints.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
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
          <div className="rounded-full bg-bg px-5 py-2 text-sm shadow-nm-inset-sm">
            {status.state === 'RUNNING' ? (
              <span className="text-success">
                ● LIVE{' '}
                {status.endAt && (
                  <>
                    · ends in <Countdown target={status.endAt} serverNow={status.serverTime} />
                  </>
                )}
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

      {/* Instrument cluster: dial + meter, echoing a hardware control panel */}
      <section className="grid gap-8 md:grid-cols-[auto_1fr]">
        <Panel title="~/arena/activity" bodyClassName="flex items-center justify-center p-8">
          <Dial value={scoringPct} label="teams scoring" />
        </Panel>
        <Panel title="~/arena/stats" bodyClassName="flex flex-col justify-between gap-5 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-muted">Total solves</div>
              <div className="font-mono text-6xl tabular-nums text-fg">
                {board ? <CountUp value={totalSolves} /> : '—'}
              </div>
            </div>
            <SignalBars filled={activity} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MiniStat label="Teams" value={board ? teamCount : undefined} />
            <MiniStat label="Challenges" value={challenges?.length} />
            <MiniStat label="Scoring" value={board ? scoringTeams : undefined} />
          </div>
        </Panel>
      </section>

      {/* Quick dock: the active-looking tile is the page's main call to action */}
      <section className="rounded-3xl bg-panel p-3 shadow-nm-raised">
        <div className="grid grid-cols-4 gap-2">
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col items-center gap-1.5 rounded-2xl py-4 text-fg-muted transition-shadow hover:bg-bg hover:text-accent hover:shadow-nm-inset-sm"
            >
              <Icon size={22} />
              <span className="text-xs">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Panel title="~/scoreboard/top5">
          {!board ? (
            <Skeleton className="h-40" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-fg-muted">No teams on the board yet — be the first.</p>
          ) : (
            <ol className="space-y-3">
              {rows.slice(0, 5).map((r) => (
                <li key={r.teamId} className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-2.5 shadow-nm-inset-sm">
                  <span className="w-6 text-center font-mono text-fg-muted">{r.rank}</span>
                  <TeamAvatar seed={r.avatarSeed} size={26} />
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

      <section className="grid gap-8 md:grid-cols-3">
        {[
          ['01 Register', 'Create an account and form a team of up to four.'],
          ['02 Solve', 'Work through categories from Web to Pwn and submit CTF{...} flags.'],
          ['03 Climb', 'Score rises with each solve; points decay as others catch up. Draw first blood for a bonus.'],
        ].map(([t, d], i) => (
          <Reveal key={t} index={i}>
            <div className="h-full rounded-3xl bg-panel p-7 shadow-nm-raised">
              <div className="font-mono text-lg text-accent">{t}</div>
              <div className="mt-2 text-sm leading-relaxed text-fg-muted">{d}</div>
            </div>
          </Reveal>
        ))}
      </section>
    </div>
  );
}
