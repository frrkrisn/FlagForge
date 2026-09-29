import { X } from 'lucide-react';
import { useState } from 'react';
import { Button, Input } from '../components/ui';
import { cn } from '../lib/cn';
import { ensureReadableAccent } from './contrast';
import {
  FONT_STACKS,
  PRESETS,
  type FontChoice,
  type SizeChoice,
} from './presets';
import { useTheme } from './useTheme';

const EFFECTS: { key: 'glow' | 'scanlines' | 'vignette' | 'motion' | 'boot'; label: string }[] = [
  { key: 'glow', label: 'Phosphor glow' },
  { key: 'scanlines', label: 'Scanlines' },
  { key: 'vignette', label: 'CRT vignette' },
  { key: 'motion', label: 'Animations' },
  { key: 'boot', label: 'Boot sequence' },
];

export function ThemeCustomizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setPreset, setAccent, toggleEffect, setTheme, reset, exportTheme, importTheme } =
    useTheme();
  const [note, setNote] = useState<string | null>(null);
  const [importText, setImportText] = useState('');

  if (!open) return null;

  const onAccentChange = (hex: string) => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#070b08';
    const { hex: safe, adjusted } = ensureReadableAccent(hex, bg);
    setAccent(safe);
    setNote(adjusted ? 'Adjusted for readability (WCAG AA)' : null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-label="Theme customizer">
      <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-panel">
        <header className="term-titlebar sticky top-0">
          <span className="term-dot" style={{ background: 'var(--danger)' }} />
          <span className="term-dot" style={{ background: 'var(--warning)' }} />
          <span className="term-dot" style={{ background: 'var(--success)' }} />
          <span className="ml-2">~/theme</span>
          <button className="ml-auto text-fg-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-6 p-4">
          <section>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Preset</h3>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPreset(p.id);
                    setAccent(null);
                    setNote(null);
                  }}
                  className={cn(
                    'flex flex-col gap-2 rounded border p-2 text-left transition-colors',
                    theme.preset === p.id ? 'border-accent' : 'border-border hover:border-border-strong',
                  )}
                >
                  <div className="flex gap-1" aria-hidden>
                    <span className="h-5 w-5 rounded" style={{ background: p.swatch.bg }} />
                    <span className="h-5 w-5 rounded" style={{ background: p.swatch.accent }} />
                    <span className="h-5 w-5 rounded" style={{ background: p.swatch.fg }} />
                  </div>
                  <span className="text-xs text-fg">{p.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Custom accent</h3>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Accent color"
                value={theme.accent ?? '#00ff88'}
                onChange={(e) => onAccentChange(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-border bg-overlay"
              />
              <Input
                value={theme.accent ?? ''}
                placeholder="#00ff88"
                onChange={(e) => onAccentChange(e.target.value)}
              />
              {theme.accent && (
                <Button variant="ghost" size="sm" onClick={() => setAccent(null)}>
                  clear
                </Button>
              )}
            </div>
            {note && <p className="mt-1 text-xs text-warning">{note}</p>}
          </section>

          <section>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Effects</h3>
            <div className="flex flex-col gap-2">
              {EFFECTS.map((e) => (
                <label key={e.key} className="flex cursor-pointer items-center justify-between text-sm">
                  <span className="text-fg">{e.label}</span>
                  <input
                    type="checkbox"
                    checked={theme.effects[e.key]}
                    onChange={() => toggleEffect(e.key)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Font
              <select
                value={theme.font}
                onChange={(e) => setTheme({ font: e.target.value as FontChoice })}
                className="h-9 rounded border border-border bg-overlay px-2 text-sm text-fg"
              >
                {Object.keys(FONT_STACKS).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              Size
              <select
                value={theme.size}
                onChange={(e) => setTheme({ size: e.target.value as SizeChoice })}
                className="h-9 rounded border border-border bg-overlay px-2 text-sm text-fg"
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </label>
            <label className="col-span-2 flex cursor-pointer items-center justify-between text-sm">
              <span className="text-fg">Readable long-form (Inter)</span>
              <input
                type="checkbox"
                checked={theme.readable}
                onChange={() => setTheme({ readable: !theme.readable })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportText(exportTheme())}>
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (importTheme(importText)) setNote('Theme imported');
                  else setNote('Invalid theme string');
                }}
              >
                Import
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
                Reset
              </Button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste a theme string to import, or Export to copy yours"
              className="h-20 w-full resize-none rounded border border-border bg-overlay p-2 font-mono text-xs text-fg"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
