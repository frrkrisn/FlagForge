import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAdminScoreboard, useChallenges, useSubmissions } from '../../api/hooks';
import type { SubmitResult } from '../../api/types';
import { Panel } from '../../components/Panel';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { Field } from './shared';
import { downloadText, toCsv } from './util';

const PAGE = 15;

const RESULT_STYLE: Record<string, { label: string; color: string; glyph: string }> = {
  CORRECT: { label: 'correct', color: 'var(--success)', glyph: '[ OK ]' },
  WRONG: { label: 'wrong', color: 'var(--fg-muted)', glyph: '[ -- ]' },
  FLAG_SHARING: { label: 'flag sharing', color: 'var(--danger)', glyph: '[FAIL]' },
  ALREADY_SOLVED: { label: 'duplicate', color: 'var(--info)', glyph: '[ == ]' },
};

export default function SubmissionsTab() {
  const [result, setResult] = useState<'' | SubmitResult>('');
  const [team, setTeam] = useState('');
  const [challenge, setChallenge] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (result) p.set('result', result);
    if (team) p.set('team', team);
    if (challenge) p.set('challenge', challenge);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [result, team, challenge]);

  const { data, isLoading } = useSubmissions(query, true);
  const { data: teams } = useAdminScoreboard(true);
  const { data: challenges } = useChallenges();

  // Newest first, then a client-side text filter on top of the server filters.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(data ?? [])]
      .reverse()
      .filter((s) => !needle || `${s.teamName} ${s.playerName} ${s.challengeTitle}`.toLowerCase().includes(needle));
  }, [data, q]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const visible = rows.slice(safePage * PAGE, safePage * PAGE + PAGE);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of rows) c[s.result] = (c[s.result] ?? 0) + 1;
    return c;
  }, [rows]);

  const exportCsv = () =>
    downloadText(
      `submissions-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`,
      toCsv([['time', 'team', 'player', 'challenge', 'result'], ...rows.map((s) => [s.at, s.teamName, s.playerName, s.challengeTitle, s.result])]),
    );

  const reset = () => setPage(0);

  return (
    <div className="space-y-8">
      <Panel title="~/admin/filters" bodyClassName="p-6 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Result">
            <select value={result} onChange={(e) => { setResult(e.target.value as '' | SubmitResult); reset(); }} className="h-11 w-full px-4 text-sm">
              <option value="">All results</option>
              <option value="CORRECT">Correct</option>
              <option value="WRONG">Wrong</option>
              <option value="FLAG_SHARING">Flag sharing</option>
            </select>
          </Field>
          <Field label="Team">
            <select value={team} onChange={(e) => { setTeam(e.target.value); reset(); }} className="h-11 w-full px-4 text-sm">
              <option value="">All teams</option>
              {(teams ?? []).map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
              ))}
            </select>
          </Field>
          <Field label="Challenge">
            <select value={challenge} onChange={(e) => { setChallenge(e.target.value); reset(); }} className="h-11 w-full px-4 text-sm">
              <option value="">All challenges</option>
              {(challenges ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="team, player, challenge" className="pl-10" />
            </div>
          </Field>
        </div>
      </Panel>

      <Panel
        title="~/admin/submissions"
        bodyClassName="p-0"
        actions={
          <>
            <span className="hidden items-center gap-2 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> live · 8s
            </span>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={14} /> CSV
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-7 py-5 text-xs text-fg-muted">
          <span><span className="text-fg">{rows.length}</span> shown</span>
          {Object.entries(counts).map(([k, n]) => (
            <span key={k} style={{ color: RESULT_STYLE[k]?.color }}>{n} {RESULT_STYLE[k]?.label ?? k.toLowerCase()}</span>
          ))}
        </div>
        {isLoading ? (
          <Skeleton className="m-6 h-72" />
        ) : visible.length === 0 ? (
          <div className="p-6"><EmptyState title="No submissions match" hint="Adjust the filters, or wait for teams to start solving." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-6 py-4 text-left">Time</th>
                  <th className="px-6 py-4 text-left">Team</th>
                  <th className="hidden px-6 py-4 text-left md:table-cell">Player</th>
                  <th className="px-6 py-4 text-left">Challenge</th>
                  <th className="px-6 py-4 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const st = RESULT_STYLE[s.result] ?? { label: s.result.toLowerCase(), color: 'var(--fg-muted)', glyph: '[ ?? ]' };
                  return (
                    <tr key={s.id} className="border-t border-border/60 transition-colors hover:bg-bg/60">
                      <td className="whitespace-nowrap px-6 py-3.5 text-xs text-fg-muted">{format(new Date(s.at), 'MMM d, HH:mm:ss')}</td>
                      <td className="px-6 py-3.5 font-mono text-fg">{s.teamName}</td>
                      <td className="hidden px-6 py-3.5 text-fg-muted md:table-cell">{s.playerName}</td>
                      <td className="px-6 py-3.5 text-fg">{s.challengeTitle}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-mono text-xs" style={{ color: st.color }}>
                        {st.glyph} {st.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between px-7 py-5 text-xs text-fg-muted">
          <span>Page {safePage + 1} of {pages}</span>
          <span className="flex gap-2">
            <Button size="icon" variant="outline" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button size="icon" variant="outline" aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
              <ChevronRight size={16} />
            </Button>
          </span>
        </div>
      </Panel>
    </div>
  );
}
