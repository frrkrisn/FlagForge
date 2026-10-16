import { cn } from '../lib/cn';

/** Compact navbar glyph: a terminal prompt `>_`. */
export function LogoGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="text-accent">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
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

// 5x5 block-letter glyphs drawn with solid blocks only (box-drawing characters are not in
// the bundled font and fall back to a different one, which breaks the alignment).
const GLYPHS: Record<string, string[]> = {
  F: ['█████', '█    ', '████ ', '█    ', '█    '],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  G: [' ████', '█    ', '█  ██', '█   █', ' ████'],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
};

const WORD = 'FLAGFORGE';
const ROWS = Array.from({ length: 5 }, (_, row) => [...WORD].map((ch) => GLYPHS[ch][row]).join(' '));
const CELL = 8;
// One rect per filled cell: the grid is drawn, not typeset, so it is pixel-perfect at any size.
const CELLS = ROWS.flatMap((line, y) =>
  [...line].flatMap((c, x) => (c === '█' ? [{ x: x * CELL, y: y * CELL }] : [])),
);
const COLS = ROWS[0].length;

/** Big pixel wordmark for the hero and auth screens. Size it with a width class. */
export function AsciiWordmark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="FlagForge"
      viewBox={`0 0 ${COLS * CELL} ${ROWS.length * CELL}`}
      className={cn('block select-none text-accent', className)}
      style={{ fill: 'currentColor', filter: 'drop-shadow(0 0 10px color-mix(in srgb, var(--accent) var(--glow-alpha), transparent))' }}
    >
      {CELLS.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} rx={1.5} />
      ))}
    </svg>
  );
}
