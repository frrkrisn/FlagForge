import { Check, Copy, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CountUp } from '../../components/motion';
import { cn } from '../../lib/cn';

/** A pressed-in track with a raised "thumb" on the active option. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex flex-wrap gap-1.5 rounded-2xl bg-bg p-1.5 shadow-nm-inset-sm', className)}
    >
      {options.map(({ value: v, label: text, icon: Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs transition-all duration-200',
              active ? 'bg-panel text-accent shadow-nm-raised-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {Icon && <Icon size={13} />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled form field with an optional hint line. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-2', className)}>
      <span className="block text-xs uppercase tracking-wider text-fg-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-fg-muted">{hint}</span>}
    </label>
  );
}

/** A raised metric tile with an icon, an animated number and a caption. */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'accent',
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  sub?: string;
  tone?: 'accent' | 'warning' | 'danger' | 'info';
}) {
  const color = { accent: 'var(--accent)', warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)' }[tone];
  return (
    <div className="flex h-full items-center gap-4 rounded-3xl bg-panel p-5 shadow-nm-raised">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-bg shadow-nm-inset-sm" style={{ color }}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-3xl tabular-nums leading-none text-fg">
          {value === undefined ? '—' : <CountUp value={value} />}
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-wider text-fg-muted">{label}</div>
        {sub && <div className="mt-1 text-[11px] leading-snug text-fg-muted">{sub}</div>}
      </div>
    </div>
  );
}

/** Copies text and shows "Copied" for a moment. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="nm-btn inline-flex h-9 items-center gap-2 px-3.5 text-xs"
      aria-live="polite"
    >
      {done ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
      {done ? 'Copied' : label}
    </button>
  );
}

/** A small tag-style toggle used for multi-select (e.g. prerequisites). */
export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-xs transition-all duration-200',
        active ? 'bg-bg text-accent shadow-nm-inset-sm' : 'bg-panel text-fg-muted shadow-nm-raised-sm hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
