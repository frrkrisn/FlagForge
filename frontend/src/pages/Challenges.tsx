import { Check, Crown, Lock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChallenges } from '../api/hooks';
import type { Category, ChallengeListItem, Difficulty } from '../api/types';
import { CategoryBadge, DifficultyBadge, PointsBadge } from '../components/domain';
import { Reveal } from '../components/motion';
import { Prompt } from '../components/Panel';
import { EmptyState, Input, Skeleton } from '../components/ui';
import { cn } from '../lib/cn';

const CATEGORIES: Category[] = ['WEB', 'CRYPTO', 'FORENSICS', 'REVERSE', 'PWN', 'MISC'];

// Filter chips: raised when idle, pressed-in when selected.
const chip = 'rounded-full px-4 py-1.5 text-xs transition-shadow';
const chipOn = 'bg-bg text-accent shadow-nm-inset-sm';
const chipOff = 'bg-panel text-fg-muted shadow-nm-raised-sm hover:text-fg';
const DIFFS: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

function Card({ c }: { c: ChallengeListItem }) {
  return (
    <Link
      to={`/challenges/${c.id}`}
      className={cn(
        'group relative flex h-full flex-col gap-4 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-0.5',
        // solved = pressed into the surface; open = raised and lifts a touch on hover
        c.solved ? 'bg-bg shadow-nm-inset' : 'bg-panel shadow-nm-raised hover:shadow-nm-raised-sm',
      )}
    >
      {c.locked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-3xl bg-panel/90 text-center backdrop-blur-sm">
          <Lock size={18} className="text-fg-muted" />
          <span className="px-3 text-xs text-fg-muted">
            Requires {c.missingPrerequisites.map((p) => p.title).join(', ')}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-fg">{c.title}</div>
        <div className="flex items-center gap-1">
          {c.firstBloodByMyTeam && <Crown size={16} className="text-warning" aria-label="First blood" />}
          {c.solved && <Check size={16} className="text-accent" aria-label="Solved" />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={c.category} />
        <DifficultyBadge difficulty={c.difficulty} />
      </div>
      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-fg-muted">
        <PointsBadge current={c.currentPoints} base={c.basePoints} min={c.minPoints} />
        <span>{c.solveCount} solves</span>
      </div>
    </Link>
  );
}

export default function Challenges() {
  const { data, isLoading, isError, refetch } = useChallenges();
  const [cat, setCat] = useState<Category | 'ALL'>('ALL');
  const [diff, setDiff] = useState<Difficulty | 'ALL'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'SOLVED' | 'UNSOLVED' | 'LOCKED'>('ALL');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of data ?? []) m[c.category] = (m[c.category] ?? 0) + 1;
    return m;
  }, [data]);

  const filtered = (data ?? []).filter((c) => {
    if (cat !== 'ALL' && c.category !== cat) return false;
    if (diff !== 'ALL' && c.difficulty !== diff) return false;
    if (status === 'SOLVED' && !c.solved) return false;
    if (status === 'UNSOLVED' && (c.solved || c.locked)) return false;
    if (status === 'LOCKED' && !c.locked) return false;
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <Prompt cursor className="text-3xl">
        ls challenges
      </Prompt>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCat('ALL')}
          className={cn(chip, cat === 'ALL' ? chipOn : chipOff)}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(chip, cat === c ? chipOn : chipOff)}
          >
            {c[0] + c.slice(1).toLowerCase()} {counts[c] ? `(${counts[c]})` : ''}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search" className="h-8 w-40 pl-7" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(['ALL', 'UNSOLVED', 'SOLVED', 'LOCKED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn('rounded-full px-3 py-1', status === s ? 'bg-bg text-accent shadow-nm-inset-sm' : 'text-fg-muted hover:text-fg')}
          >
            {s.toLowerCase()}
          </button>
        ))}
        {DIFFS.map((d) => (
          <button
            key={d}
            onClick={() => setDiff(diff === d ? 'ALL' : d)}
            className={cn('rounded-full px-3 py-1', diff === d ? 'bg-bg text-accent shadow-nm-inset-sm' : 'text-fg-muted hover:text-fg')}
          >
            {d.toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}
      {isError && (
        <EmptyState title="Could not load challenges" hint="The server may be unreachable." action={<button className="text-accent" onClick={() => refetch()}>$ retry</button>} />
      )}
      {data && filtered.length === 0 && (
        <EmptyState title="No challenges match" hint="Try clearing the filters or search." />
      )}
      {filtered.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <Reveal key={c.id} index={i}>
              <Card c={c} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
