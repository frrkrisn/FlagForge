// Preset catalogue for the theme customizer. The actual token values live in
// src/styles/globals.css (keyed by data-theme); here we keep display metadata and
// representative swatches for the picker.

export type Preset =
  | 'matrix'
  | 'cyber'
  | 'amber'
  | 'synthwave'
  | 'blood'
  | 'ghost'
  | 'paper';

export type FontChoice = 'jetbrains' | 'fira' | 'ibm';
export type SizeChoice = 'sm' | 'md' | 'lg';
export type Density = 'compact' | 'comfortable';

export interface EffectFlags {
  glow: boolean;
  scanlines: boolean;
  vignette: boolean;
  motion: boolean;
  boot: boolean;
}

export interface ThemeState {
  preset: Preset;
  accent: string | null; // custom accent hex; null = use preset default
  effects: EffectFlags;
  font: FontChoice;
  size: SizeChoice;
  density: Density;
  readable: boolean;
}

export interface PresetInfo {
  id: Preset;
  label: string;
  note: string;
  swatch: { bg: string; fg: string; accent: string };
  light?: boolean;
}

export const PRESETS: PresetInfo[] = [
  { id: 'matrix', label: 'Matrix Green', note: 'Classic phosphor green', swatch: { bg: '#070b08', fg: '#c9f7d8', accent: '#00ff88' } },
  { id: 'cyber', label: 'Cyber Cyan', note: 'Cool blue-cyan', swatch: { bg: '#060b10', fg: '#d0f4ff', accent: '#00e5ff' } },
  { id: 'amber', label: 'Amber CRT', note: 'Old amber monitor', swatch: { bg: '#0d0a04', fg: '#ffe2a8', accent: '#ffb000' } },
  { id: 'synthwave', label: 'Synthwave', note: 'Neon magenta', swatch: { bg: '#0d0714', fg: '#f3d9ff', accent: '#ff2bd6' } },
  { id: 'blood', label: 'Blood Red', note: 'Red-team look', swatch: { bg: '#0d0505', fg: '#ffd6d6', accent: '#ff3b3b' } },
  { id: 'ghost', label: 'Ghost Mono', note: 'Grayscale', swatch: { bg: '#0a0a0a', fg: '#d4d4d4', accent: '#e6e6e6' } },
  { id: 'paper', label: 'Paper', note: 'Light e-ink terminal', swatch: { bg: '#f4f1e8', fg: '#1a1a1a', accent: '#0a7a3d' }, light: true },
];

export const FONT_STACKS: Record<FontChoice, string> = {
  jetbrains: "'JetBrains Mono', ui-monospace, monospace",
  fira: "'Fira Code', ui-monospace, monospace",
  ibm: "'IBM Plex Mono', ui-monospace, monospace",
};

export const SIZE_PX: Record<SizeChoice, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
};

export const DEFAULT_THEME: ThemeState = {
  preset: 'matrix',
  accent: null,
  effects: { glow: true, scanlines: true, vignette: true, motion: true, boot: true },
  font: 'jetbrains',
  size: 'md',
  density: 'comfortable',
  readable: false,
};

export const THEME_STORAGE_KEY = 'ctf.theme.v1';
