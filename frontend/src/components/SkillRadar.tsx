import { Award } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import type { Skill } from '../api/types';
import { Badge } from './ui';

const BADGE_INFO: Record<string, string> = {
  FIRST_BLOOD: 'Was the first to solve a challenge',
  ON_THE_BOARD: 'Has at least one solve',
  ALL_ROUNDER: 'Solved in 4 or more categories',
  HARD_HITTER: 'Solved a hard challenge',
  VETERAN: 'Solved 10 or more challenges',
};

export function badgeLabel(b: string) {
  return b.replace(/_/g, ' ').toLowerCase();
}

export function badgeHint(b: string) {
  if (b.startsWith('MASTER_')) return `Solved every ${b.slice(7).toLowerCase()} challenge`;
  return BADGE_INFO[b] ?? b;
}

export function BadgeList({ badges }: { badges: string[] }) {
  if (badges.length === 0) return <p className="text-sm text-fg-muted">No badges yet. Solve something to earn the first one.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span key={b} title={badgeHint(b)}>
          <Badge color="var(--warning)">
            <Award size={12} /> {badgeLabel(b)}
          </Badge>
        </span>
      ))}
    </div>
  );
}

/** Per-category completion, as a radar plus a legend of exact numbers. */
export function SkillRadar({ skills }: { skills: Skill[] }) {
  const data = skills.map((s) => ({
    category: s.category.toLowerCase(),
    pct: s.total === 0 ? 0 : Math.round((s.solved / s.total) * 100),
  }));
  return (
    <div className="grid items-center gap-6 sm:grid-cols-2">
      <div role="img" aria-label="Skill radar: percentage of each category solved">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="var(--fg-muted)" strokeOpacity={0.3} />
            <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} />
            <Radar dataKey="pct" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.3} isAnimationActive animationDuration={600} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {skills.map((s) => (
          <li key={s.category} className="flex items-center justify-between rounded-xl bg-bg px-4 py-2 shadow-nm-inset-sm">
            <span className="font-mono uppercase text-fg-muted">{s.category.toLowerCase()}</span>
            <span className="text-fg">
              {s.solved}/{s.total} <span className="text-fg-muted">· {s.points} pts</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
