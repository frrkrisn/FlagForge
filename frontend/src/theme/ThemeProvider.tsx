import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyTheme, loadTheme, saveTheme } from './apply';
import { ThemeContext, type ThemeContextValue } from './context';
import { DEFAULT_THEME, type EffectFlags, type Preset, type ThemeState } from './presets';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeState>(() => loadTheme());
  const firstRender = useRef(true);

  // Apply + persist whenever the theme changes.
  useEffect(() => {
    applyTheme(theme);
    // Skip persisting on the very first paint (already applied by the no-flash script).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveTheme(theme);
  }, [theme]);

  const setTheme = useCallback((updater: Partial<ThemeState>) => {
    setThemeState((prev) => ({ ...prev, ...updater }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      setPreset: (preset: Preset) => setThemeState((p) => ({ ...p, preset })),
      setAccent: (hex: string | null) => setThemeState((p) => ({ ...p, accent: hex })),
      toggleEffect: (key: keyof EffectFlags) =>
        setThemeState((p) => ({ ...p, effects: { ...p.effects, [key]: !p.effects[key] } })),
      reset: () => setThemeState(DEFAULT_THEME),
      exportTheme: () => JSON.stringify(theme),
      importTheme: (json: string) => {
        try {
          const parsed = JSON.parse(json) as Partial<ThemeState>;
          setThemeState((p) => ({
            ...p,
            ...parsed,
            effects: { ...p.effects, ...(parsed.effects ?? {}) },
          }));
          return true;
        } catch {
          return false;
        }
      },
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
