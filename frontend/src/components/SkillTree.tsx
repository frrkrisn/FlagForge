import { Check, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ChallengeListItem } from '../api/types';
import { cn } from '../lib/cn';

const NODE_W = 190;
const NODE_H = 64;
const GAP_X = 90;
const GAP_Y = 22;

/** Longest prerequisite chain ending at each challenge (cycle-safe). */
function depths(items: ChallengeListItem[]) {
  const byId = new Map(items.map((c) => [c.id, c]));
  const memo = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    let d = 0;
    for (const p of byId.get(id)?.prerequisiteIds ?? []) {
      if (byId.has(p)) d = Math.max(d, visit(p, seen) + 1);
    }
    seen.delete(id);
    memo.set(id, d);
    return d;
  };
  items.forEach((c) => visit(c.id, new Set()));
  return memo;
}

/**
 * The challenge graph as columns: a challenge sits one column right of its deepest
 * prerequisite, so unlocking reads left to right. Challenges with no links are left out
 * (they would just be loose dots); the card view still lists them.
 */
export function SkillTree({ items }: { items: ChallengeListItem[] }) {
  const layout = useMemo(() => {
    const linked = new Set<string>();
    const ids = new Set(items.map((c) => c.id));
    for (const c of items) {
      for (const p of c.prerequisiteIds) {
        if (ids.has(p)) {
          linked.add(c.id);
          linked.add(p);
        }
      }
    }
    const nodes = items.filter((c) => linked.has(c.id));
    const d = depths(nodes);
    const cols: ChallengeListItem[][] = [];
    for (const c of nodes) (cols[d.get(c.id) ?? 0] ??= []).push(c);
    const pos = new Map<string, { x: number; y: number }>();
    cols.forEach((col, ci) => {
      col?.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
      col?.forEach((c, ri) => pos.set(c.id, { x: ci * (NODE_W + GAP_X), y: ri * (NODE_H + GAP_Y) }));
    });
    const rows = Math.max(1, ...cols.map((c) => c?.length ?? 0));
    return {
      nodes,
      pos,
      width: cols.length * (NODE_W + GAP_X) - GAP_X,
      height: rows * (NODE_H + GAP_Y) - GAP_Y,
    };
  }, [items]);

  if (layout.nodes.length === 0) {
    return <p className="text-sm text-fg-muted">No challenge depends on another yet, so there is no tree to draw.</p>;
  }
  const solved = new Set(items.filter((c) => c.solved).map((c) => c.id));

  return (
    <div className="overflow-x-auto rounded-3xl bg-bg p-6 shadow-nm-inset-sm">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg className="absolute inset-0" width={layout.width} height={layout.height} aria-hidden>
          {layout.nodes.flatMap((c) =>
            c.prerequisiteIds.map((p) => {
              const a = layout.pos.get(p);
              const b = layout.pos.get(c.id);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={`${p}-${c.id}`}
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={solved.has(p) ? 'var(--accent)' : 'var(--fg-muted)'}
                  strokeOpacity={solved.has(p) ? 0.9 : 0.35}
                  strokeWidth={solved.has(p) ? 2.5 : 1.5}
                  strokeDasharray={solved.has(p) ? undefined : '5 5'}
                />
              );
            }),
          )}
        </svg>
        {layout.nodes.map((c) => {
          const p = layout.pos.get(c.id)!;
          return (
            <Link
              key={c.id}
              to={`/challenges/${c.id}`}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              className={cn(
                'absolute flex flex-col justify-center gap-0.5 rounded-2xl px-4 transition-transform hover:-translate-y-0.5',
                c.solved ? 'bg-bg text-accent shadow-nm-inset-sm' : 'bg-panel shadow-nm-raised-sm',
                c.locked && 'opacity-60',
              )}
              title={c.locked ? `Requires ${c.missingPrerequisites.map((m) => m.title).join(', ')}` : c.title}
            >
              <span className="flex items-center gap-1.5 truncate font-mono text-sm text-fg">
                {c.solved && <Check size={13} className="shrink-0 text-accent" />}
                {c.locked && <Lock size={12} className="shrink-0 text-fg-muted" />}
                <span className="truncate">{c.title}</span>
              </span>
              <span className="text-[11px] uppercase tracking-wider text-fg-muted">
                {c.category.toLowerCase()} · {c.currentPoints} pts
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
