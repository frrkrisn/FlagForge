import { createContext } from 'react';
import type { EffectFlags, Preset, ThemeState } from './presets';

export interface ThemeContextValue {
  theme: ThemeState;
  setTheme: (updater: Partial<ThemeState>) => void;
  setPreset: (preset: Preset) => void;
  setAccent: (hex: string | null) => void;
  toggleEffect: (key: keyof EffectFlags) => void;
  reset: () => void;
  exportTheme: () => string;
  importTheme: (json: string) => boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
