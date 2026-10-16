import { formatDistanceToNow } from 'date-fns';
import { KeyRound, Search, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { useAdminScoreboard, useChallenges, useRevealFlag } from '../../api/hooks';
import { Panel } from '../../components/Panel';
import { TeamAvatar } from '../../components/TeamAvatar';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';
import { CopyButton, Field } from './shared';

const selectClass = 'h-11 w-full px-4 text-sm';

function FlagVault({ teams }: { teams: { teamId: string; teamName: string }[] }) {
  const { data: challenges } = useChallenges();
  const reveal = useRevealFlag();
  const [teamId, setTeamId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [flag, setFlag] = useState<string | null>(null);

  return (
    <Panel title="~/admin/flag-vault" bodyClassName="space-y-6 p-7">
      <div className="flex items-start gap-3 rounded-2xl bg-bg p-4 text-xs text-warning shadow-nm-inset-sm">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        Demo tool. Reveals a team&apos;s unique flag for a per-team challenge so you can show flag-sharing detection. Only works on challenges that use per-team flags.
      </div>
      <Field label="Team">
        <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setFlag(null); }} className={selectClass}>
          <option value="">Choose a team…</option>
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
          ))}
        </select>
      </Field>
      <Field label="Challenge">
        <select value={challengeId} onChange={(e) => { setChallengeId(e.target.value); setFlag(null); }} className={selectClass}>
          <option value="">Choose a challenge…</option>
          {(challenges ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </Field>
      <Button
        className="w-full"
        disabled={!teamId || !challengeId}
        loading={reveal.isPending}
        onClick={() =>
          reveal.mutate(
            { teamId, challengeId },
            {
              onSuccess: (d) => setFlag(d.flag),
              onError: (e) => {
                setFlag(null);
                toast.error(e instanceof ApiError ? e.message : 'Could not reveal the flag');
              },
            },
          )
        }
      >
        <KeyRound size={16} /> Reveal flag
      </Button>
      {flag && (
        <div className="space-y-3 rounded-2xl bg-bg p-5 shadow-nm-inset-sm">
          <code className="block break-all font-mono text-sm text-accent">{flag}</code>
          <CopyButton text={flag} label="Copy flag" />
        </div>
      )}
    </Panel>
  );
}

export default function TeamsTab() {
  const { data: rows, isLoading } = useAdminScoreboard(true);
  const [q, setQ] = useState('');
  const shown = (rows ?? []).filter((r) => r.teamName.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[1.6fr_1fr]">
      <Panel
        title="~/admin/teams (live)"
        bodyClassName="p-0"
        actions={
          <span className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search" aria-label="Search teams" className="h-9 w-44 rounded-xl pl-9 text-xs" />
          </span>
        }
      >
        {isLoading ? (
          <Skeleton className="m-6 h-72" />
        ) : shown.length === 0 ? (
          <div className="p-6"><EmptyState title={q ? 'No team matches' : 'No teams yet'} /></div>
        ) : (
          <div className="max-h-[42rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel text-xs uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-5 py-4 text-left">#</th>
                  <th className="px-5 py-4 text-left">Team</th>
                  <th className="px-5 py-4 text-right">Score</th>
                  <th className="hidden px-5 py-4 text-right sm:table-cell">Solves</th>
                  <th className="hidden px-5 py-4 text-right md:table-cell">Last solve</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.teamId} className="border-t border-border/60 transition-colors hover:bg-bg/60">
                    <td className={cn('px-5 py-3.5 font-mono', r.rank <= 3 ? 'text-warning' : 'text-fg-muted')}>{r.rank}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/teams/${r.teamId}`} className="flex items-center gap-3 hover:text-accent">
                        <TeamAvatar seed={r.avatarSeed} size={26} />
                        <span className="font-mono">{r.teamName}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-accent">{r.score}</td>
                    <td className="hidden px-5 py-3.5 text-right tabular-nums text-fg-muted sm:table-cell">{r.solves}</td>
                    <td className="hidden px-5 py-3.5 text-right text-xs text-fg-muted md:table-cell">
                      {r.solves ? formatDistanceToNow(new Date(r.lastSolveAt), { addSuffix: true }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <FlagVault teams={rows ?? []} />
    </div>
  );
}
