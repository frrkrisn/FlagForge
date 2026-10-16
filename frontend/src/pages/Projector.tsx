import { AnimatePresence, motion } from 'framer-motion';
import { Droplet, Maximize, Minimize, Snowflake, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAnnouncements, useEventStatus, useFeed, useScoreboard } from '../api/hooks';
import type { Category, FeedEvent } from '../api/types';
import { categoryColor, Countdown } from '../components/domain';
import { TeamAvatar } from '../components/TeamAvatar';
import { cn } from '../lib/cn';

const CATS: Category[] = ['WEB', 'CRYPTO', 'FORENSICS', 'REVERSE', 'PWN', 'MISC'];
const ROWS = 10;

/** Feed entries that deserve a full-screen moment. */
function isBig(e: FeedEvent) {
  return e.type === 'FIRST_BLOOD' || e.type === 'EVENT_ENDED' || e.type === 'EVENT_STARTED';
}

const SHOWN = new Set(['SOLVE', 'FIRST_BLOOD', 'TEAM_CREATED', 'TEAM_JOINED', 'EVENT_STARTED', 'EVENT_PAUSED', 'EVENT_RESUMED', 'EVENT_ENDED', 'ANNOUNCEMENT']);

const keyOf = (e: FeedEvent) => `${e.at}|${e.type}|${e.message}`;

function useFullscreen() {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const h = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggle = useCallback(() => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen can be refused; the page still works windowed */
    }
  }, []);
  return { on, toggle };
}

/** Pops a banner for each new big feed event, but never for the backlog present at load. */
function useBanner(feed: FeedEvent[] | undefined) {
  const seen = useRef<string | null>(null);
  const [banner, setBanner] = useState<FeedEvent | null>(null);
  useEffect(() => {
    if (!feed) return undefined;
    if (seen.current === null) {
      seen.current = feed.length ? keyOf(feed[feed.length - 1]) : '';
      return undefined;
    }
    const idx = feed.findIndex((e) => keyOf(e) === seen.current);
    const fresh = idx === -1 ? (seen.current === '' ? feed : []) : feed.slice(idx + 1);
    if (fresh.length) seen.current = keyOf(fresh[fresh.length - 1]);
    const big = [...fresh].reverse().find(isBig);
    if (big) {
      setBanner(big);
      const t = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [feed]);
  return banner;
}

export default function Projector() {
  const { data: board } = useScoreboard();
  const { data: status } = useEventStatus();
  const { data: feed } = useFeed();
  const { data: announcements } = useAnnouncements();
  const fs = useFullscreen();
  const banner = useBanner(feed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') fs.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]);

  const rows = (board?.rows ?? []).slice(0, ROWS);
  const top = rows[0]?.score ?? 0;
  const recent = useMemo(() => [...(feed ?? [])].filter((e) => SHOWN.has(e.type)).reverse().slice(0, 9), [feed]);
  const catTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of board?.rows ?? []) for (const c of CATS) t[c] = (t[c] ?? 0) + (r.categorySolves[c] ?? 0);
    return t;
  }, [board]);
  const catMax = Math.max(1, ...CATS.map((c) => catTotals[c] ?? 0));
  const notice = announcements?.[0];

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-bg p-8 text-fg">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="font-mono text-4xl font-bold text-accent">
          flagforge<span className="text-fg-muted">://mission-control</span>
        </div>
        <div className="flex items-center gap-6">
          {status && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.3em] text-fg-muted">
                {status.frozen ? 'scoreboard frozen' : status.state.replace('_', ' ').toLowerCase()}
              </div>
              <div className="font-mono text-5xl">
                {status.state === 'RUNNING' && status.endAt ? (
                  <Countdown target={status.endAt} serverNow={status.serverTime} />
                ) : status.state === 'NOT_STARTED' && status.startAt ? (
                  <Countdown target={status.startAt} serverNow={status.serverTime} />
                ) : (
                  <span className={status.state === 'RUNNING' ? 'text-accent' : 'text-fg-muted'}>{status.state === 'RUNNING' ? 'LIVE' : '--:--:--'}</span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={fs.toggle}
            aria-label={fs.on ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen (F)"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-panel text-fg-muted shadow-nm-raised-sm hover:text-accent"
          >
            {fs.on ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <Link
            to="/scoreboard"
            aria-label="Leave projector mode"
            title="Leave"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-panel text-fg-muted shadow-nm-raised-sm hover:text-accent"
          >
            <X size={18} />
          </Link>
        </div>
      </header>

      {notice && (
        <div className="rounded-2xl bg-panel px-6 py-3 text-lg shadow-nm-inset-sm">
          <span className="mr-3 font-mono text-warning">[{notice.title}]</span>
          {notice.body}
        </div>
      )}

      <main className="grid flex-1 gap-8 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-3xl bg-panel p-6 shadow-nm-raised">
          <div className="mb-4 flex items-center gap-3 font-mono text-xl text-fg-muted">
            top --live
            {board?.frozen && <Snowflake size={18} className="text-info" />}
          </div>
          {rows.length === 0 && <p className="py-12 text-center text-2xl text-fg-muted">Waiting for the first solve…</p>}
          <ol className="space-y-2">
            {rows.map((r) => (
              <motion.li
                key={r.teamId}
                layout="position"
                transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                className={cn(
                  'relative flex items-center gap-5 overflow-hidden rounded-2xl px-5 py-3',
                  r.rank === 1 ? 'bg-bg shadow-nm-inset-sm' : 'bg-bg/40',
                )}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-accent/10"
                  style={{ width: `${top > 0 ? (r.score / top) * 100 : 0}%`, transition: 'width 0.8s ease' }}
                  aria-hidden
                />
                <span className="relative w-10 text-center font-mono text-3xl tabular-nums text-fg-muted">{r.rank}</span>
                <TeamAvatar seed={r.avatarSeed} size={40} />
                <span className="relative min-w-0 flex-1 truncate font-mono text-3xl">{r.teamName}</span>
                <span className="relative text-lg text-fg-muted">{r.solves} solves</span>
                <span className="relative w-32 text-right font-mono text-4xl tabular-nums text-accent">{r.score}</span>
              </motion.li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-8">
          <section className="flex-1 rounded-3xl bg-panel p-6 shadow-nm-raised">
            <div className="mb-4 font-mono text-xl text-fg-muted">tail -f feed</div>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {recent.map((e) => (
                  <motion.li
                    key={keyOf(e)}
                    layout
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn('rounded-xl bg-bg px-4 py-2 text-lg', e.type === 'FIRST_BLOOD' && 'text-danger')}
                  >
                    {e.type === 'FIRST_BLOOD' && <Droplet size={16} className="mr-2 inline" />}
                    {e.message}
                    {e.points ? <span className="ml-2 font-mono text-accent">+{e.points}</span> : null}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {recent.length === 0 && <p className="text-fg-muted">Nothing yet.</p>}
          </section>

          <section className="rounded-3xl bg-panel p-6 shadow-nm-raised">
            <div className="mb-4 font-mono text-xl text-fg-muted">solves by category</div>
            <div className="space-y-2">
              {CATS.map((c) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="w-28 font-mono text-sm uppercase text-fg-muted">{c.toLowerCase()}</span>
                  <div className="h-4 flex-1 rounded-full bg-bg shadow-nm-inset-sm">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${((catTotals[c] ?? 0) / catMax) * 100}%`,
                        background: categoryColor(c),
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono tabular-nums">{catTotals[c] ?? 0}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {banner && (
          <motion.div
            role="status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-x-0 top-1/3 z-50 mx-auto w-[min(90vw,60rem)] rounded-3xl bg-panel p-10 text-center shadow-nm-raised"
          >
            <div className="mb-2 font-mono text-sm uppercase tracking-[0.4em] text-danger">
              {banner.type === 'FIRST_BLOOD' ? 'first blood' : 'event update'}
            </div>
            <div className="font-mono text-4xl text-accent">{banner.message}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
