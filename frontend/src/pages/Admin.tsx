import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ApiError } from '../api/client';
import {
  useAdminChallengeMutations,
  useAlerts,
  useChallenges,
  useEventControl,
  useEventStatus,
  useMe,
  usePostAnnouncement,
  useSetFreeze,
  useSubmissions,
} from '../api/hooks';
import { Panel, Prompt } from '../components/Panel';
import { Button, EmptyState, Input, Skeleton } from '../components/ui';
import { cn } from '../lib/cn';

const TABS = ['Event', 'Challenges', 'Submissions', 'Alerts', 'Announce'] as const;
type Tab = (typeof TABS)[number];

function EventTab() {
  const { data } = useEventStatus();
  const control = useEventControl();
  const freeze = useSetFreeze();
  const [endText, setEndText] = useState('');
  const [freezeAt, setFreezeAt] = useState('');

  return (
    <div className="space-y-4">
      <Panel title="~/admin/event">
        <div className="mb-4 text-lg">
          State: <span className="font-mono text-accent">{data?.state ?? '…'}</span>
          {data?.frozen && <span className="ml-2 text-info">❄ frozen</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => control.mutate('start')}>Start</Button>
          <Button size="sm" variant="outline" onClick={() => control.mutate('pause')}>Pause</Button>
          <Button size="sm" variant="outline" onClick={() => control.mutate('resume')}>Resume</Button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Input value={endText} onChange={(e) => setEndText(e.target.value)} placeholder='type END to end' className="w-40" />
          <Button size="sm" variant="danger" disabled={endText !== 'END'} onClick={() => control.mutate('end')}>
            End event
          </Button>
        </div>
      </Panel>
      <Panel title="~/admin/freeze">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={freezeAt}
            onChange={(e) => setFreezeAt(e.target.value)}
            className="h-10 rounded border border-border bg-overlay px-3 text-sm text-fg"
          />
          <Button
            size="sm"
            onClick={() => {
              if (!freezeAt) return;
              freeze.mutate(new Date(freezeAt).toISOString(), { onSuccess: () => toast.success('Freeze set') });
            }}
          >
            Set freeze
          </Button>
          <span className="text-xs text-fg-muted">Public board freezes at this time; admin board stays live.</span>
        </div>
      </Panel>
    </div>
  );
}

function DecayPreview({ base, min, decay }: { base: number; min: number; decay: number }) {
  const data = useMemo(() => {
    const pts = [];
    for (let s = 0; s <= Math.max(decay * 2, 10); s++) {
      const coeff = decay > 0 && min < base ? (min - base) / (decay * decay) : 0;
      pts.push({ s, v: Math.max(min, Math.ceil(coeff * s * s + base)) });
    }
    return pts;
  }, [base, min, decay]);
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="s" stroke="var(--fg-muted)" fontSize={10} />
        <YAxis stroke="var(--fg-muted)" fontSize={10} />
        <Line type="monotone" dataKey="v" stroke="var(--accent)" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChallengesTab() {
  const { data: challenges } = useChallenges();
  const { create, remove, setVisibility } = useAdminChallengeMutations();
  const [f, setF] = useState({
    title: '', category: 'WEB', difficulty: 'EASY', description: '', basePoints: 100,
    strategy: 'DECAY', minPoints: 20, decay: 10, flagType: 'STATIC', flag: '', flagPrefix: 'CTF', prerequisites: '',
  });

  const submit = () => {
    const spec = {
      title: f.title, category: f.category, difficulty: f.difficulty, description: f.description,
      basePoints: Number(f.basePoints),
      scoring: { strategy: f.strategy, minPoints: Number(f.minPoints), decay: Number(f.decay) },
      flagType: f.flagType, flag: f.flag, flagPrefix: f.flagPrefix,
      prerequisites: f.prerequisites.split(',').map((s) => s.trim()).filter(Boolean),
      hints: [], attachments: [], visible: true,
    };
    create.mutate(spec, {
      onSuccess: () => { toast.success('Challenge created'); setF({ ...f, title: '', flag: '' }); },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
    });
  };

  const input = (k: keyof typeof f, props: Record<string, unknown> = {}) => (
    <Input value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="~/admin/challenges/new">
        <div className="space-y-3">
          {input('title', { placeholder: 'title' })}
          <div className="grid grid-cols-2 gap-2">
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="h-10 rounded border border-border bg-overlay px-2 text-sm text-fg">
              {['WEB', 'CRYPTO', 'FORENSICS', 'REVERSE', 'PWN', 'MISC'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} className="h-10 rounded border border-border bg-overlay px-2 text-sm text-fg">
              {['EASY', 'MEDIUM', 'HARD'].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="markdown description" className="h-20 w-full rounded border border-border bg-overlay p-2 text-sm text-fg" />
          <div className="grid grid-cols-3 gap-2">
            {input('basePoints', { type: 'number', placeholder: 'base' })}
            {input('minPoints', { type: 'number', placeholder: 'min' })}
            {input('decay', { type: 'number', placeholder: 'decay' })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={f.strategy} onChange={(e) => setF({ ...f, strategy: e.target.value })} className="h-10 rounded border border-border bg-overlay px-2 text-sm text-fg">
              {['STATIC', 'DECAY', 'DECAY_FIRSTBLOOD', 'DYNAMIC', 'DYNAMIC_FIRSTBLOOD'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={f.flagType} onChange={(e) => setF({ ...f, flagType: e.target.value })} className="h-10 rounded border border-border bg-overlay px-2 text-sm text-fg">
              {['STATIC', 'DYNAMIC'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {f.flagType === 'STATIC' ? input('flag', { placeholder: 'CTF{flag}' }) : input('flagPrefix', { placeholder: 'CTF' })}
          {input('prerequisites', { placeholder: 'prereq ids, comma-separated' })}
          <div>
            <div className="mb-1 text-xs text-fg-muted">decay preview (display only)</div>
            <DecayPreview base={Number(f.basePoints)} min={Number(f.minPoints)} decay={Number(f.decay)} />
          </div>
          <Button className="w-full" loading={create.isPending} onClick={submit} disabled={!f.title || (f.flagType === 'STATIC' && !f.flag)}>
            Create challenge
          </Button>
        </div>
      </Panel>
      <Panel title="~/admin/challenges" bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {(challenges ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-2 p-3 text-sm">
              <span className="font-mono text-fg">{c.title}</span>
              <span className="text-xs text-fg-muted">{c.category} · {c.currentPoints}pts · {c.solveCount} solves</span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setVisibility.mutate({ id: c.id, visible: false })}>hide</Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>delete</Button>
              </div>
            </li>
          ))}
          {challenges?.length === 0 && <li className="p-4"><EmptyState title="No challenges yet" /></li>}
        </ul>
      </Panel>
    </div>
  );
}

function SubmissionsTab() {
  const [result, setResult] = useState('');
  const query = result ? `?result=${result}` : '';
  const { data, isLoading } = useSubmissions(query, true);
  return (
    <Panel title="~/admin/submissions" bodyClassName="p-0" actions={
      <select value={result} onChange={(e) => setResult(e.target.value)} className="rounded border border-border bg-overlay px-2 py-1 text-xs text-fg">
        <option value="">all</option>
        {['CORRECT', 'WRONG', 'FLAG_SHARING'].map((r) => <option key={r}>{r}</option>)}
      </select>
    }>
      {isLoading ? <Skeleton className="m-4 h-40" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-fg-muted"><tr className="border-b border-border"><th className="p-2 text-left">Time</th><th className="p-2 text-left">Team</th><th className="p-2 text-left">Player</th><th className="p-2 text-left">Challenge</th><th className="p-2 text-left">Result</th></tr></thead>
            <tbody>
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border">
                  <td className="p-2 text-fg-muted">{new Date(s.at).toLocaleTimeString()}</td>
                  <td className="p-2 text-fg">{s.teamName}</td>
                  <td className="p-2 text-fg-muted">{s.playerName}</td>
                  <td className="p-2 text-fg">{s.challengeTitle}</td>
                  <td className={cn('p-2 font-mono', s.result === 'CORRECT' ? 'text-accent' : s.result === 'FLAG_SHARING' ? 'text-danger' : 'text-fg-muted')}>{s.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.length === 0 && <div className="p-4"><EmptyState title="No submissions yet" /></div>}
        </div>
      )}
    </Panel>
  );
}

function AlertsTab() {
  const { data } = useAlerts(true);
  return (
    <Panel title="~/admin/alerts">
      {!data || data.length === 0 ? (
        <EmptyState title="No alerts" hint="Flag-sharing and burst-submission alerts will appear here." />
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id} className={cn('rounded border p-3 text-sm', a.status === 'OPEN' ? 'border-danger/50 bg-danger/5' : 'border-border opacity-60')}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-danger">{a.kind}</span>
                <span className="text-xs text-fg-muted">{a.status}</span>
              </div>
              <p className="mt-1 text-fg-muted">{a.evidence}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AnnounceTab() {
  const post = usePostAnnouncement();
  const [t, setT] = useState({ title: '', body: '', severity: 'INFO' });
  return (
    <Panel title="~/admin/announce">
      <div className="space-y-3">
        <Input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="title" />
        <textarea value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} placeholder="message" className="h-24 w-full rounded border border-border bg-overlay p-2 text-sm text-fg" />
        <select value={t.severity} onChange={(e) => setT({ ...t, severity: e.target.value })} className="h-10 rounded border border-border bg-overlay px-2 text-sm text-fg">
          {['INFO', 'WARNING', 'CRITICAL'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button loading={post.isPending} onClick={() => post.mutate(t, { onSuccess: () => { toast.success('Announced'); setT({ title: '', body: '', severity: 'INFO' }); } })} disabled={!t.title}>
          Post announcement
        </Button>
      </div>
    </Panel>
  );
}

export default function Admin() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>('Event');

  if (isLoading) return <Skeleton className="h-64" />;
  if (!me || me.role !== 'ADMIN')
    return (
      <div className="mx-auto max-w-lg py-16">
        <Panel title="~/403">
          <p className="text-danger">permission denied: admin access required</p>
          <Link to="/" className="mt-3 inline-block text-accent">← back home</Link>
        </Panel>
      </div>
    );

  return (
    <div className="space-y-6">
      <Prompt cursor className="text-2xl">sudo admin</Prompt>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm', tab === t ? 'border-b-2 border-accent text-accent' : 'text-fg-muted hover:text-fg')}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Event' && <EventTab />}
      {tab === 'Challenges' && <ChallengesTab />}
      {tab === 'Submissions' && <SubmissionsTab />}
      {tab === 'Alerts' && <AlertsTab />}
      {tab === 'Announce' && <AnnounceTab />}
    </div>
  );
}
