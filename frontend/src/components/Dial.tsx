import { useEffect, useState } from 'react';
import { cn } from '../lib/cn';
import { CountUp } from './motion';

/**
 * A soft-UI rotary dial: a raised knob housing a recessed face, with a 270° progress
 * arc in the accent colour. Purely presentational — the caller passes a 0–100 value
 * that the server already produced; the dial never derives game state.
 */
export function Dial({
  value,
  label,
  size = 176,
  className,
}: {
  value: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  // The arc starts empty and sweeps to the value (CSS transition does the animating).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const stroke = 9;
  const r = size / 2 - 20;
  const c = 2 * Math.PI * r;
  const sweep = 0.75 * c; // 270° of the circle
  const angle = -135 + (270 * shown) / 100; // knob marker position
  const inner = size - 46;

  return (
    <div
      className={cn('relative shrink-0 rounded-full bg-panel shadow-nm-raised', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${pct} percent`}
    >
      <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(135deg)' }} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${sweep} ${c}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(sweep * shown) / 100} ${c}`}
          style={{
            filter: 'drop-shadow(0 0 5px color-mix(in srgb, var(--accent) var(--glow-alpha), transparent))',
            transition: 'stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </svg>

      {/* recessed face */}
      <div
        className="absolute flex flex-col items-center justify-center rounded-full bg-bg shadow-nm-inset"
        style={{ inset: (size - inner) / 2 }}
      >
        <span className="font-mono text-3xl font-bold tabular-nums text-fg">
          <CountUp value={pct} />%
        </span>
        <span className="mt-0.5 max-w-[70%] text-center text-[10px] uppercase tracking-wider text-fg-muted">{label}</span>
        {/* marker nub riding the face edge */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-0 w-0"
          style={{ transform: `rotate(${angle}deg) translateY(-${inner / 2 - 9}px)` }}
        >
          <span className="absolute -left-1 -top-1 block h-2 w-2 rounded-full bg-accent" />
        </span>
      </div>
    </div>
  );
}

/** Rising bars (like a volume meter). `filled` of `count` bars are lit. */
export function SignalBars({
  filled,
  count = 7,
  className,
}: {
  filled: number;
  count?: number;
  className?: string;
}) {
  const lit = Math.max(0, Math.min(count, Math.round(filled)));
  return (
    <div className={cn('flex items-end gap-1.5', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn('w-2.5 rounded-full transition-colors duration-500', i < lit ? 'bg-accent' : 'bg-bg shadow-nm-inset-sm')}
          style={{
            transitionDelay: `${i * 70}ms`,
            height: 16 + i * 9,
            boxShadow: i < lit ? '0 0 8px color-mix(in srgb, var(--accent) var(--glow-alpha), transparent)' : undefined,
          }}
        />
      ))}
    </div>
  );
}
