import { Bug, Boxes, Cpu, Globe, Lock, Search, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Category, Difficulty } from '../api/types';
import { cn } from '../lib/cn';

const CATEGORY: Record<Category, { icon: LucideIcon; label: string; varName: string }> = {
  WEB: { icon: Globe, label: 'Web', varName: '--cat-web' },
  CRYPTO: { icon: Lock, label: 'Crypto', varName: '--cat-crypto' },
  FORENSICS: { icon: Search, label: 'Forensics', varName: '--cat-forensics' },
  REVERSE: { icon: Cpu, label: 'Reverse', varName: '--cat-reverse' },
  PWN: { icon: Bug, label: 'Pwn', varName: '--cat-misc' },
  MISC: { icon: Boxes, label: 'Misc', varName: '--cat-misc' },
};

// eslint-disable-next-line react-refresh/only-export-components
export function categoryColor(c: Category): string {
  return `var(${CATEGORY[c].varName})`;
}

export function CategoryBadge({ category }: { category: Category }) {
  const { icon: Icon, label } = CATEGORY[category];
  const color = categoryColor(category);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-xs font-medium shadow-nm-inset-sm"
      style={{ color }}
    >
      <Icon size={12} aria-hidden />
      {label}
    </span>
  );
}

// Difficulty as filled/empty blocks + label, so meaning never relies on color alone.
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const filled = difficulty === 'EASY' ? 1 : difficulty === 'MEDIUM' ? 2 : 3;
  const blocks = [0, 1, 2].map((i) => (i < filled ? '■' : '□')).join('');
  const label = difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted" title={label}>
      <span aria-hidden className="tracking-tighter text-accent">
        [{blocks}]
      </span>
      <span className="sr-only">{label} difficulty</span>
      {label}
    </span>
  );
}

export function PointsBadge({
  current,
  base,
  min,
  className,
}: {
  current: number;
  base: number;
  min: number;
  className?: string;
}) {
  const decayed = current < base;
  return (
    <span
      className={cn('font-mono text-sm tabular-nums', decayed ? 'text-warning' : 'text-accent', className)}
      title={`initial ${base} → current ${current} → min ${min}`}
    >
      {current}
      <span className="text-fg-muted"> pts</span>
    </span>
  );
}

/** Countdown that corrects for client clock skew using the server's time. */
export function Countdown({ target, serverNow }: { target: string; serverNow: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const offset = Date.now() - new Date(serverNow).getTime();
  const remaining = new Date(target).getTime() - (Date.now() - offset);
  if (remaining <= 0) return <span className="tabular-nums text-fg-muted">00:00:00</span>;
  const s = Math.floor(remaining / 1000);
  const d = Math.floor(s / 86400);
  const h = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return (
    <span className="tabular-nums text-accent">
      {d > 0 ? `${d}d ` : ''}
      {h}:{m}:{sec}
    </span>
  );
}
