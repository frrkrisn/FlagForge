// WCAG relative-luminance contrast utilities used by the theme customizer to keep a
// custom accent readable (docs/PLAYBOOK.md §8.4 accessibility guard).

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse a #rrggbb or #rgb hex string to RGB (0–255). Returns null if invalid. */
export function hexToRgb(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Relative luminance per WCAG 2.1. */
export function luminance({ r, g, b }: Rgb): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** Contrast ratio between two colors (1–21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAA(a: Rgb, b: Rgb): boolean {
  return contrastRatio(a, b) >= 4.5;
}

/**
 * Nudge an accent's lightness (toward or away from the background) until it meets
 * the 4.5:1 AA threshold against `bg`. Returns the adjusted hex (or the original if
 * it already passes / cannot be fixed).
 */
export function ensureReadableAccent(accentHex: string, bgHex: string): { hex: string; adjusted: boolean } {
  const accent = hexToRgb(accentHex);
  const bg = hexToRgb(bgHex);
  if (!accent || !bg) return { hex: accentHex, adjusted: false };
  if (meetsAA(accent, bg)) return { hex: accentHex, adjusted: false };

  const bgLum = luminance(bg);
  const towardLight = bgLum < 0.5; // dark bg -> brighten the accent
  let current = { ...accent };
  for (let step = 0; step < 40; step++) {
    const factor = towardLight ? 1.06 : 0.94;
    current = { r: current.r * factor, g: current.g * factor, b: current.b * factor };
    if (meetsAA(current, bg)) {
      return { hex: rgbToHex(current), adjusted: true };
    }
  }
  return { hex: rgbToHex(current), adjusted: true };
}
