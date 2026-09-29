import { LogOut, Palette, Shield, Trophy, Flag, Users, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEventStatus, useLogout, useMe } from '../api/hooks';
import { Countdown } from '../components/domain';
import { Wordmark } from '../components/Logo';
import { Button } from '../components/ui';
import { cn } from '../lib/cn';
import { ThemeCustomizer } from '../theme/ThemeCustomizer';
import { useTheme } from '../theme/useTheme';

const NAV = [
  { to: '/challenges', label: 'Challenges', icon: Flag },
  { to: '/scoreboard', label: 'Scoreboard', icon: Trophy },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/rules', label: 'Rules', icon: ScrollText },
];

function EventPill() {
  const { data } = useEventStatus();
  if (!data) return null;
  const color =
    data.state === 'RUNNING' ? 'var(--success)' : data.state === 'PAUSED' ? 'var(--warning)' : 'var(--fg-muted)';
  const label = data.frozen ? 'FROZEN ❄' : data.state.replace('_', ' ');
  return (
    <span className="hidden items-center gap-2 rounded border border-border px-2 py-1 text-xs sm:inline-flex" style={{ color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
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

  return (
    <div className="flex min-h-screen flex-col">
      {theme.effects.scanlines && <div className="fx-scanlines" aria-hidden />}
      {theme.effects.vignette && <div className="fx-vignette" aria-hidden />}

      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4">
          <Link to="/" aria-label="FlagForge home">
            <Wordmark />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-overlay text-accent' : 'text-fg-muted hover:text-fg',
                  )
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
            {me?.role === 'ADMIN' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn('flex items-center gap-1.5 rounded px-3 py-1.5 text-sm', isActive ? 'bg-overlay text-accent' : 'text-fg-muted hover:text-fg')
                }
              >
                <Shield size={14} /> Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <EventPill />
            <Button variant="ghost" size="icon" aria-label="Customize theme" onClick={() => setThemeOpen(true)}>
              <Palette size={18} />
            </Button>
            {me ? (
              <div className="flex items-center gap-2">
                <Link to={`/players/${me.id}`} className="hidden text-sm text-fg hover:text-accent sm:block">
                  {me.username}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Log out"
                  onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
                >
                  <LogOut size={18} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Register</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="sticky bottom-0 z-40 flex border-t border-border bg-bg/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]', isActive ? 'text-accent' : 'text-fg-muted')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <footer className="border-t border-border py-4 text-center text-xs text-fg-muted">
        flagforge · a CTF competition platform · {new Date().getFullYear()}
      </footer>

      <ThemeCustomizer open={themeOpen} onClose={() => setThemeOpen(false)} />
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { fontFamily: 'var(--font-mono)' } }} />
    </div>
  );
}
