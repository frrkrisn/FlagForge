import type { Severity } from '../../api/types';

/** Token-based colour for each announcement/alert severity (never a hard-coded colour). */
export const SEVERITY_COLOR: Record<Severity, string> = {
  INFO: 'var(--info)',
  WARNING: 'var(--warning)',
  CRITICAL: 'var(--danger)',
};

/** How serious each anti-cheat alert kind is. */
export function alertSeverity(kind: string): Severity {
  return kind === 'FLAG_SHARING' ? 'CRITICAL' : 'WARNING';
}

export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A readable random flag, e.g. CTF{brave_otter_4821}. */
export function randomFlag(): string {
  const adj = ['quiet', 'brave', 'rusty', 'lucky', 'silent', 'neon', 'hidden', 'frozen'];
  const noun = ['otter', 'falcon', 'kernel', 'cipher', 'packet', 'socket', 'beacon', 'vector'];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `CTF{${pick(adj)}_${pick(noun)}_${Math.floor(1000 + Math.random() * 9000)}}`;
}
