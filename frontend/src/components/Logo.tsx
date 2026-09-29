import { cn } from '../lib/cn';

/** Compact navbar glyph: a terminal prompt `>_`. */
export function LogoGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="text-accent">
      <rect x="1" y="1" width="22" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <LogoGlyph />
      <span className={cn('font-mono text-lg font-bold tracking-tight text-fg', className)}>
        flag<span className="text-accent">forge</span>
      </span>
    </div>
  );
}

const ASCII = String.raw`
 ___ _           ___
| __| |__ _ __ _| __|__ _ _ __ _ ___
| _|| / _\` / _\` | _/ _ \ '_/ _\` / -_)
|_| |_\__,_\__, |_|\___/_| \__, \___|
           |___/           |___/        `;

/** Big ASCII wordmark for the hero / boot screen. */
export function AsciiWordmark({ className }: { className?: string }) {
  return (
    <pre
      className={cn('glow-text overflow-x-auto font-mono leading-tight text-accent', className)}
      aria-label="FlagForge"
    >
      {ASCII}
    </pre>
  );
}
