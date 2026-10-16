import { formatDistanceToNow } from 'date-fns';
import {
  Crown,
  Flag,
  Lightbulb,
  Megaphone,
  Play,
  ShieldAlert,
  Skull,
  Snowflake,
  Target,
  Timer,
  UserPlus,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  useAdminScoreboard,
  useAlerts,
  useChallenges,
  useEventStatus,
  useFeed,
  useSubmissions,
} from '../../api/hooks';
import { Dial } from '../../components/Dial';
import { Reveal } from '../../components/motion';
import { Panel } from '../../components/Panel';
import { TeamAvatar } from '../../components/TeamAvatar';
import { EmptyState, Skeleton } from '../../components/ui';
import { StatTile } from './shared';

const FEED_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  SOLVE: { icon: Target, color: 'var(--success)' },
  FIRST_BLOOD: { icon: Crown, color: 'var(--warning)' },
  WRONG_ATTEMPT: { icon: XCircle, color: 'var(--fg-muted)' },
  HINT_UNLOCKED: { icon: Lightbulb, color: 'var(--warning)' },
  TEAM_CREATED: { icon: Users, color: 'var(--info)' },
  TEAM_JOINED: { icon: UserPlus, color: 'var(--info)' },
  EVENT_STARTED: { icon: Play, color: 'var(--success)' },
  EVENT_PAUSED: { icon: Timer, color: 'var(--warning)' },
  EVENT_RESUMED: { icon: Play, color: 'var(--success)' },
  EVENT_ENDED: { icon: Flag, color: 'var(--danger)' },
  FLAG_SHARING: { icon: Skull, color: 'var(--danger)' },
  COOLDOWN_TRIGGERED: { icon: Snowflake, color: 'var(--info)' },
  ANNOUNCEMENT: { icon: Megaphone, color: 'var(--info)' },
};

export default function Overview() {
  const { data: status } = useEventStatus();
  const { data: rows, isLoading: rowsLoading } = useAdminScoreboard(true);
  const { data: subs } = useSubmissions('', true);
  const { data: alerts } = useAlerts(true);
  const { data: challenges } = useChallenges();
  const { data: feed } = useFeed();

  const total = subs?.length ?? 0;
  const correct = subs?.filter((s) => s.result === 'CORRECT').length ?? 0;
  const openAlerts = alerts?.filter((a) => a.status === 'OPEN').length ?? 0;
  const correctPct = total ? (correct / total) * 100 : 0;

  // Display-only bucketing of the submission log into the last 24 hours.
  const hourly = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const start = now - (24 - i) * 3600_000;
      return { label: new Date(start + 1800_000).getHours() + ':00', start, correct: 0, other: 0 };
    });
    for (const s of subs ?? []) {
      const t = new Date(s.at).getTime();
      const idx = Math.floor((t - (now - 24 * 3600_000)) / 3600_000);
      if (idx >= 0 && idx < 24) buckets[idx][s.result === 'CORRECT' ? 'correct' : 'other']++;
    }
    return buckets;
  }, [subs]);

  const recentFeed = [...(feed ?? [])].reverse().slice(0, 8);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal index={0}>
          <StatTile icon={Users} label="Teams" value={rows?.length} sub={status ? `event ${status.state.toLowerCase().replace('_', ' ')}` : undefined} />
        </Reveal>
        <Reveal index={1}>
          <StatTile icon={Flag} label="Challenges" value={challenges?.length} tone="info" />
        </Reveal>
        <Reveal index={2}>
          <StatTile icon={Zap} label="Submissions" value={subs ? total : undefined} sub={subs ? `${correct} correct` : undefined} tone="warning" />
        </Reveal>
        <Reveal index={3}>
          <StatTile icon={ShieldAlert} label="Open alerts" value={alerts ? openAlerts : undefined} tone={openAlerts ? 'danger' : 'accent'} sub={openAlerts ? 'needs review' : 'all clear'} />
        </Reveal>
      </div>

      <div className="grid gap-8 xl:grid-cols-[auto_1fr]">
        <Panel title="~/admin/accuracy" bodyClassName="flex flex-col items-center justify-center gap-5 p-8">
          <Dial value={correctPct} label="correct rate" />
          <p className="max-w-[14rem] text-center text-xs text-fg-muted">
            Share of all submissions that were right. A very low number can mean a broken challenge.
          </p>
        </Panel>
        <Panel title="~/admin/submissions/24h" bodyClassName="p-6 sm:p-7">
          {!subs ? (
            <Skeleton className="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="var(--fg-muted)" fontSize={10} interval={2} tickLine={false} />
                <YAxis stroke="var(--fg-muted)" fontSize={10} allowDecimals={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--overlay)' }}
                  contentStyle={{ background: 'var(--panel)', border: 'none', borderRadius: 14, boxShadow: 'var(--nm-raised-sm)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  labelStyle={{ color: 'var(--fg)' }}
                />
                <Bar dataKey="correct" name="correct" stackId="a" fill="var(--chart-1)" radius={[0, 0, 4, 4]} isAnimationActive animationDuration={900} />
                <Bar dataKey="other" name="missed" stackId="a" fill="var(--chart-5)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex gap-5 text-xs text-fg-muted">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: 'var(--chart-1)' }} />correct</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: 'var(--chart-5)' }} />missed / rejected</span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="~/admin/top-teams">
          {rowsLoading ? (
            <Skeleton className="h-56" />
          ) : !rows || rows.length === 0 ? (
            <EmptyState title="No teams yet" hint="Teams appear here as players create them." />
          ) : (
            <ol className="space-y-3">
              {rows.slice(0, 8).map((r) => (
                <li key={r.teamId} className="flex items-center gap-4 rounded-2xl bg-bg px-4 py-3 shadow-nm-inset-sm">
                  <span className="w-5 text-center font-mono text-fg-muted">{r.rank}</span>
                  <TeamAvatar seed={r.avatarSeed} size={28} />
                  <span className="min-w-0 flex-1 truncate font-mono text-fg">{r.teamName}</span>
                  <span className="font-mono tabular-nums text-accent">{r.score}</span>
                  <span className="hidden w-20 text-right text-xs text-fg-muted 2xl:block">{r.solves} solves</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="~/admin/activity">
          {recentFeed.length === 0 ? (
            <EmptyState title="Quiet for now" hint="Solves, hints and alerts stream in here live." />
          ) : (
            <ul className="space-y-3">
              {recentFeed.map((e, i) => {
                const meta = FEED_ICON[e.type] ?? { icon: Zap, color: 'var(--fg-muted)' };
                const Icon = meta.icon;
                return (
                  <li key={`${e.at}-${i}`} className="flex items-start gap-3.5 rounded-2xl bg-bg px-4 py-3 shadow-nm-inset-sm">
                    <span className="mt-0.5" style={{ color: meta.color }}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug text-fg">{e.message}</span>
                      <span className="mt-0.5 block text-[11px] text-fg-muted">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
