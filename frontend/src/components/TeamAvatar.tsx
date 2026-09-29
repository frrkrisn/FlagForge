import { useMemo } from 'react';

// Deterministic 5x5 symmetric pixel identicon derived from a seed string, drawn in
// the current accent color (docs/PLAYBOOK.md §8.4). No external avatar service.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function TeamAvatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const cells = useMemo(() => {
    const h = hash(seed || '?');
    const grid: boolean[] = [];
    // 3 columns (0,1,2) mirrored to 3,4 -> 15 bits from the hash
    for (let i = 0; i < 15; i++) grid.push(((h >> i) & 1) === 1);
    return grid;
  }, [seed]);

  const cell = size / 5;
  const rects: JSX.Element[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (cells[y * 3 + x]) {
        const mirrorX = 4 - x;
        rects.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} />);
        if (mirrorX !== x)
          rects.push(<rect key={`m${x}-${y}`} x={mirrorX * cell} y={y * cell} width={cell} height={cell} />);
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${seed} avatar`}
      className="shrink-0 rounded"
      style={{ background: 'var(--overlay)', fill: 'var(--accent)' }}
    >
      {rects}
    </svg>
  );
}
