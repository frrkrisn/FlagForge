import {
  DEFAULT_THEME,
  FONT_STACKS,
  SIZE_PX,
  THEME_STORAGE_KEY,
  type ThemeState,
} from './presets';

/** Apply a theme to <html> by setting data-attributes and CSS variables. */
export function applyTheme(state: ThemeState): void {
  const root = document.documentElement;
  root.dataset.theme = state.preset;
  root.dataset.effects = state.effects.glow ? 'on' : 'off';
  root.dataset.motion = state.effects.motion ? 'on' : 'off';
  root.dataset.density = state.density;

  if (state.accent) {
    root.style.setProperty('--accent', state.accent);
  } else {
    root.style.removeProperty('--accent');
  }
  root.style.setProperty('--font-mono', FONT_STACKS[state.font]);
  root.style.setProperty('--font-sans', state.readable ? "'Inter', sans-serif" : FONT_STACKS[state.font]);
  root.style.fontSize = SIZE_PX[state.size];
}

/** Read the persisted theme, falling back to the default (never throws). */
export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    return {
      ...DEFAULT_THEME,
      ...parsed,
      effects: { ...DEFAULT_THEME.effects, ...(parsed.effects ?? {}) },
    };
  } catch {
    return DEFAULT_THEME;
  }
}

/** Persist the theme (never throws). */
export function saveTheme(state: ThemeState): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
