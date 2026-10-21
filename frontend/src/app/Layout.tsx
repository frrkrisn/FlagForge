import { MotionConfig } from 'framer-motion';
import { LogOut, Palette, Shield, SquareTerminal, Trophy, Flag, Users, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEventStatus, useLogout, useMe } from '../api/hooks';
import { Countdown } from '../components/domain';
import { Wordmark } from '../components/Logo';
import { PageTransition } from '../components/motion';
import { Button } from '../components/ui';
import { cn } from '../lib/cn';
import { ThemeCustomizer } from '../theme/ThemeCustomizer';
import { useTheme } from '../theme/useTheme';

const NAV = [
  { to: '/challenges', label: 'Challenges', icon: Flag },
  { to: '/scoreboard', label: 'Scoreboard', icon: Trophy },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/terminal', label: 'Terminal', icon: SquareTerminal },
  { to: '/rules', label: 'Rules', icon: ScrollText },
];

// Active = pressed into the surface; idle = flat until hovered (then it lifts).
const navClass = (isActive: boolean) =>
  cn(
    'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition-shadow',
    isActive ? 'bg-bg text-accent shadow-nm-inset-sm' : 'text-fg-muted hover:text-fg hover:shadow-nm-raised-sm',
  );

function EventPill() {
  const { data } = useEventStatus();
  if (!data) return null;
  const color =
    data.state === 'RUNNING' ? 'var(--success)' : data.state === 'PAUSED' ? 'var(--warning)' : 'var(--fg-muted)';
  const label = data.frozen ? 'FROZEN ❄' : data.state.replace('_', ' ');
  return (
    <span
      className="hidden items-center gap-2 rounded-full bg-bg px-3 py-1.5 text-xs shadow-nm-inset-sm lg:inline-flex"
      style={{ color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
      {data.state === 'RUNNING' && data.endAt && (
        <span className="text-fg-muted">
          · <Countdown target={data.endAt} serverNow={data.serverTime} />
        </span>
      )}
    </span>
  );
}

export function Layout() {
  const { theme } = useTheme();
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [themeOpen, setThemeOpen] = useState(false);

  const lightToasts = ['paper', 'arctic', 'sakura'].includes(theme.preset);

  return (
    <MotionConfig reducedMotion={theme.effects.motion ? 'user' : 'always'}>
    <div className="flex min-h-screen flex-col">
      {theme.effects.scanlines && <div className="fx-scanlines" aria-hidden />}
      {theme.effects.vignette && <div className="fx-vignette" aria-hidden />}

      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <header className="mx-auto flex h-[4.5rem] max-w-[1280px] items-center gap-3 rounded-3xl bg-panel px-5 shadow-nm-raised">
          <Link to="/" aria-label="FlagForge home" className="rounded-xl px-1">
            <Wordmark />
          </Link>
          <nav className="ml-3 hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => navClass(isActive)}>
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
            {me?.role === 'ADMIN' && (
              <NavLink to="/admin" className={({ isActive }) => navClass(isActive)}>
                <Shield size={14} /> Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <EventPill />
            <Button variant="outline" size="icon" aria-label="Customize theme" onClick={() => setThemeOpen(true)}>
              <Palette size={17} />
            </Button>
            {me ? (
              <div className="flex items-center gap-2">
                <Link to={`/players/${me.id}`} className="hidden text-sm text-fg hover:text-accent lg:block">
                  {me.username}
                </Link>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Log out"
                  onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
                >
                  <LogOut size={17} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="outline" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Register</Button>
                </Link>
              </div>
            )}
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 sm:px-6 sm:py-12">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      {/* Mobile bottom nav: a floating raised dock */}
      <nav className="sticky bottom-3 z-40 mx-3 mb-3 flex rounded-3xl bg-panel p-1.5 shadow-nm-raised md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px]',
                isActive ? 'bg-bg text-accent shadow-nm-inset-sm' : 'text-fg-muted',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <footer className="py-6 text-center text-xs text-fg-muted">
        flagforge · a CTF competition platform · {new Date().getFullYear()}
      </footer>

      <ThemeCustomizer open={themeOpen} onClose={() => setThemeOpen(false)} />
      <Toaster
        theme={lightToasts ? 'light' : 'dark'}
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-mono)',
            background: 'var(--panel)',
            color: 'var(--fg)',
            border: 'none',
            borderRadius: '18px',
            boxShadow: 'var(--nm-raised-sm)',
            padding: '16px 18px',
          },
        }}
      />
    </div>
    </MotionConfig>
  );
}
