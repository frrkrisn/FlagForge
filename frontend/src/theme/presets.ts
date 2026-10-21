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
  | 'paper'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'royal'
  | 'rose'
  | 'gold'
  | 'mint'
  | 'lava'
  | 'arctic'
  | 'sakura';

export type FontChoice = 'jetbrains' | 'fira' | 'ibm';
export type SizeChoice = 'sm' | 'md' | 'lg';
export type Density = 'compact' | 'comfortable';

export interface EffectFlags {
  depth: boolean; // soft, neumorphic relief on cards/buttons/inputs
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
  { id: 'ocean', label: 'Ocean Blue', note: 'Deep sea blue', swatch: { bg: '#050b18', fg: '#d6e6ff', accent: '#3b82f6' } },
  { id: 'forest', label: 'Forest', note: 'Mossy woodland', swatch: { bg: '#060d08', fg: '#d9f2d0', accent: '#6bcf4a' } },
  { id: 'sunset', label: 'Sunset Orange', note: 'Warm dusk', swatch: { bg: '#120905', fg: '#ffe3d0', accent: '#ff7a2f' } },
  { id: 'royal', label: 'Royal Purple', note: 'Deep violet', swatch: { bg: '#0a0614', fg: '#e8dcff', accent: '#9b6bff' } },
  { id: 'rose', label: 'Rose Pink', note: 'Soft rose', swatch: { bg: '#140609', fg: '#ffdce6', accent: '#ff5c8a' } },
  { id: 'gold', label: 'Gold', note: 'Luxe gold', swatch: { bg: '#0e0b03', fg: '#fff0bf', accent: '#ffd23f' } },
  { id: 'mint', label: 'Mint', note: 'Fresh teal-mint', swatch: { bg: '#041110', fg: '#d2fff5', accent: '#2ee6c8' } },
  { id: 'lava', label: 'Lava', note: 'Molten red-orange', swatch: { bg: '#120504', fg: '#ffd9cc', accent: '#ff4d1a' } },
  { id: 'arctic', label: 'Arctic Light', note: 'Light icy blue', swatch: { bg: '#eef4fa', fg: '#10202e', accent: '#0b6bcb' }, light: true },
  { id: 'sakura', label: 'Sakura Light', note: 'Light blossom', swatch: { bg: '#fbf0f3', fg: '#2a1219', accent: '#c2185b' }, light: true },
];

export const FONT_STACKS: Record<FontChoice, string> = {
  jetbrains: "'JetBrains Mono', ui-monospace, monospace",
  fira: "'Fira Code', ui-monospace, monospace",
  ibm: "'IBM Plex Mono', ui-monospace, monospace",
};

export const SIZE_PX: Record<SizeChoice, string> = {
  sm: '15px',
  md: '17px',
  lg: '19px',
};

export const DEFAULT_THEME: ThemeState = {
  preset: 'matrix',
  accent: null,
  effects: { depth: true, glow: true, scanlines: false, vignette: false, motion: true, boot: true },
  font: 'jetbrains',
  size: 'md',
  density: 'comfortable',
  readable: false,
};

export const THEME_STORAGE_KEY = 'ctf.theme.v1';

// One-tap accent colours shown in the theme sidebar (they go through the same WCAG readability check as the picker).
export const ACCENT_SWATCHES = [
  '#00ff88', '#00e5ff', '#3b82f6', '#9b6bff', '#ff2bd6', '#ff5c8a', '#ff3b3b', '#ff7a2f',
  '#ffb000', '#ffd23f', '#a3e635', '#2ee6c8', '#38bdf8', '#f472b6', '#e6e6e6', '#fb923c',
];
