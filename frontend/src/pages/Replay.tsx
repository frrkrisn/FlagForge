import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTimeline } from '../api/hooks';
import { Panel, Prompt } from '../components/Panel';
import { TeamAvatar } from '../components/TeamAvatar';
import { EmptyState, Skeleton } from '../components/ui';
import { cn } from '../lib/cn';
import { movesUpTo, replaySpan, standingsAt } from '../lib/replay';

/** A whole event plays back in about this long at 1x. */
const PLAYBACK_SECONDS = 30;
const SPEEDS = [1, 2, 4, 8];
const ROWS = 10;

export default function Replay() {
  const { data: teams, isLoading } = useTimeline(50);
  const span = useMemo(() => (teams ? replaySpan(teams) : null), [teams]);

  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const raf = useRef(0);

  const at = cursor ?? span?.end ?? 0;

  // advance the cursor with the animation clock while playing
  useEffect(() => {
    if (!playing || !span) return undefined;
    const perMs = (span.end - span.start) / (PLAYBACK_SECONDS * 1000);
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      setCursor((c) => {
        const next = (c ?? span.start) + dt * perMs * speed;
        if (next >= span.end) {
          setPlaying(false);
          return span.end;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, span]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (!teams || !span) {
    return (
      <div className="space-y-6">
        <Prompt className="text-3xl">replay --event</Prompt>
        <EmptyState title="Nothing to replay yet" hint="Once teams start solving, the whole event can be played back here." />
      </div>
    );
  }

  const rows = standingsAt(teams, at).slice(0, ROWS);
  const top = rows[0]?.score ?? 0;
  const moves = movesUpTo(teams, at);
  const atEnd = at >= span.end;

  const toggle = () => {
    if (atEnd) setCursor(span.start);
    setPlaying((p) => !p);
  };

  return (
    <div className="space-y-8">
      <Prompt cursor className="text-3xl">
        replay --event
      </Prompt>

      <Panel title="~/replay/controls">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-panel text-accent shadow-nm-raised-sm hover:shadow-nm-raised"
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setCursor(span.start);
            }}
            aria-label="Back to the start"
            className="grid h-12 w-12 place-items-center rounded-2xl bg-panel text-fg-muted shadow-nm-raised-sm hover:text-accent"
          >
            <RotateCcw size={18} />
          </button>
          <input
            type="range"
            min={span.start}
            max={span.end}
            step={1000}
            value={at}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
            aria-label="Event time"
            className="min-w-48 flex-1 accent-[var(--accent)]"
          />
          <span className="w-44 text-right font-mono text-sm tabular-nums text-fg">{format(new Date(at), 'd MMM, HH:mm:ss')}</span>
          <div className="flex gap-1" role="group" aria-label="Speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  'rounded-full px-3 py-1 text-xs',
                  speed === s ? 'bg-bg text-accent shadow-nm-inset-sm' : 'bg-panel text-fg-muted shadow-nm-raised-sm',
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <Panel title="~/replay/standings">
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <motion.li
                key={r.teamId}
                layout="position"
                transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-bg px-4 py-2.5 shadow-nm-inset-sm"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-accent/10"
                  style={{ width: `${top > 0 ? (r.score / top) * 100 : 0}%` }}
                  aria-hidden
                />
                <span className="relative w-6 text-center font-mono tabular-nums text-fg-muted">{i + 1}</span>
                <TeamAvatar seed={r.teamName} size={28} />
                <span className="relative min-w-0 flex-1 truncate font-mono text-fg">{r.teamName}</span>
                <span className="relative font-mono text-xl tabular-nums text-accent">{r.score}</span>
              </motion.li>
            ))}
          </ol>
        </Panel>

        <Panel title="~/replay/moves">
          {moves.length === 0 ? (
            <p className="text-sm text-fg-muted">Nothing has happened yet at this point in the event.</p>
          ) : (
            <ul className="space-y-2">
              {moves.map((m) => (
                <li key={`${m.at}|${m.teamName}`} className="flex items-center gap-3 rounded-xl bg-bg px-4 py-2 text-sm shadow-nm-inset-sm">
                  <span className="font-mono text-xs text-fg-muted">{format(new Date(m.at), 'HH:mm')}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{m.teamName}</span>
                  <span className={cn('font-mono', m.gained >= 0 ? 'text-accent' : 'text-warning')}>
                    {m.gained >= 0 ? '+' : ''}
                    {m.gained}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
