import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Minus, Snowflake } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMe, useScoreboard, useTimeline } from '../api/hooks';
import type { Category, ScoreRow } from '../api/types';
import { categoryColor } from '../components/domain';
import { Panel, Prompt } from '../components/Panel';
import { TeamAvatar } from '../components/TeamAvatar';
import { EmptyState, Input, Skeleton } from '../components/ui';
import { cn } from '../lib/cn';

const CATS: Category[] = ['WEB', 'CRYPTO', 'FORENSICS', 'REVERSE', 'PWN', 'MISC'];
const CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

function Delta({ delta }: { delta: number }) {
  if (delta > 0) return <span className="flex items-center text-success"><ChevronUp size={14} />{delta}</span>;
  if (delta < 0) return <span className="flex items-center text-danger"><ChevronDown size={14} />{-delta}</span>;
  return <Minus size={12} className="text-fg-muted" />;
}

function medal(rank: number) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
}

function TimelineChart() {
  const { data } = useTimeline(8);
  const merged = useMemo(() => {
    if (!data) return [];
    const times = Array.from(new Set(data.flatMap((t) => t.points.map((p) => p.t)))).sort();
    return times.map((t) => {
      const row: Record<string, number | string> = { t: new Date(t).getTime() };
      for (const team of data) {
        const last = [...team.points].filter((p) => p.t <= t).pop();
        row[team.teamName] = last ? last.score : 0;
      }
      return row;
    });
  }, [data]);

  if (!data || data.length === 0) return <EmptyState title="No timeline yet" hint="Solves will appear here." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => format(new Date(v), 'd MMM')}
          minTickGap={60}
          stroke="var(--fg-muted)"
          fontSize={11}
          tickLine={false}
        />
        <YAxis stroke="var(--fg-muted)" fontSize={11} domain={[0, 'auto']} tickLine={false} />
        <Tooltip
          labelFormatter={(v) => format(new Date(Number(v)), 'd MMM, HH:mm')}
          contentStyle={{ background: 'var(--panel)', border: 'none', borderRadius: 14, boxShadow: 'var(--nm-raised-sm)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
          labelStyle={{ color: 'var(--fg)' }}
        />
        {data.map((team, i) => (
          <Line
            key={team.teamId}
            type="stepAfter"
            dataKey={team.teamName}
            stroke={`var(${CHART_VARS[i % CHART_VARS.length]})`}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function Row({ row, mine }: { row: ScoreRow; mine: boolean }) {
  return (
    <motion.tr
      layout="position"
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={cn('border-b border-border/60 transition-colors hover:bg-bg/60', mine && 'bg-accent/5')}
    >
      <td className="px-5 py-4 text-center font-mono tabular-nums">
        {medal(row.rank) ?? row.rank}
      </td>
      <td className="px-5 py-4">
        <Link to={`/teams/${row.teamId}`} className="flex items-center gap-2 hover:text-accent">
          <TeamAvatar seed={row.avatarSeed} size={24} />
          <span className={cn('font-mono', mine && 'text-accent')}>{row.teamName}</span>
        </Link>
      </td>
      <td className="hidden px-5 py-4 sm:table-cell">
        <div className="flex gap-1" aria-label="solves by category">
          {CATS.map((c) => (
            <span
              key={c}
              title={`${c}: ${row.categorySolves[c] ?? 0}`}
              className="h-2 w-2 rounded-full"
              style={{ background: (row.categorySolves[c] ?? 0) > 0 ? categoryColor(c) : 'var(--border)' }}
            />
          ))}
        </div>
      </td>
      <td className="px-5 py-4 text-right font-mono tabular-nums text-accent">{row.score}</td>
      <td className="hidden px-5 py-4 text-right tabular-nums text-fg-muted md:table-cell">{row.solves}</td>
      <td className="px-5 py-4 text-right"><Delta delta={row.rankDelta} /></td>
    </motion.tr>
  );
}

export default function ScoreboardPage() {
  const { data, isLoading, isError } = useScoreboard();
  const { data: me } = useMe();
  const [q, setQ] = useState('');

  const rows = (data?.rows ?? []).filter((r) => r.teamName.toLowerCase().includes(q.toLowerCase()));
  const myTeamId = me?.team?.id;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Prompt cursor className="text-3xl">
          top --live
        </Prompt>
        <div className="flex items-center gap-3">
          <Link to="/replay" className="rounded-full bg-panel px-4 py-1.5 text-xs text-fg-muted shadow-nm-raised-sm hover:text-accent">
            replay
          </Link>
          <Link to="/projector" className="rounded-full bg-panel px-4 py-1.5 text-xs text-fg-muted shadow-nm-raised-sm hover:text-accent">
            projector mode
          </Link>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search team" className="h-8 w-48" />
        </div>
      </div>

      {data?.frozen && (
        <div className="flex items-center gap-2 rounded-2xl bg-bg px-5 py-3 text-sm text-info shadow-nm-inset-sm">
          <Snowflake size={16} /> Scoreboard frozen{data.frozenAt ? ` at ${new Date(data.frozenAt).toLocaleString()}` : ''} — final standings reveal when the event ends.
        </div>
      )}

      <Panel title="~/scoreboard/timeline">
        <TimelineChart />
      </Panel>

      <Panel title="~/scoreboard" bodyClassName="p-0">
        {isLoading && <Skeleton className="m-4 h-64" />}
        {isError && <div className="p-6 text-danger">Could not load the scoreboard.</div>}
        {data && rows.length === 0 && <div className="p-6"><EmptyState title="No teams yet" hint="Be the first to register and solve a challenge." /></div>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-fg-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-4">#</th>
                  <th className="px-5 py-4 text-left">Team</th>
                  <th className="hidden px-5 py-4 text-left sm:table-cell">Categories</th>
                  <th className="px-5 py-4 text-right">Score</th>
                  <th className="hidden px-5 py-4 text-right md:table-cell">Solves</th>
                  <th className="px-5 py-4 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.teamId} row={r} mine={r.teamId === myTeamId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
