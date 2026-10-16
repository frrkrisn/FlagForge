import { Dices, Eye, EyeOff, Paperclip, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { useAdminChallengeMutations, useChallenges, useUploadAttachment } from '../../api/hooks';
import type { Category, Difficulty } from '../../api/types';
import { CategoryBadge } from '../../components/domain';
import { Panel } from '../../components/Panel';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { formatBytes } from '../../lib/format';
import { Field, Segmented, ToggleChip } from './shared';
import { randomFlag } from './util';

const CATEGORIES: Category[] = ['WEB', 'CRYPTO', 'FORENSICS', 'REVERSE', 'PWN', 'MISC'];
const STRATEGIES = [
  { value: 'STATIC', label: 'Fixed' },
  { value: 'DECAY', label: 'Decay' },
  { value: 'DECAY_FIRSTBLOOD', label: 'Decay + first blood' },
];

interface HintDraft {
  text: string;
  cost: number;
}

const EMPTY = {
  title: '',
  category: 'WEB' as Category,
  difficulty: 'EASY' as Difficulty,
  description: '',
  basePoints: 100,
  minPoints: 20,
  decay: 10,
  strategy: 'DECAY',
  flagType: 'STATIC' as 'STATIC' | 'DYNAMIC',
  flag: '',
  flagPrefix: 'CTF',
  prerequisites: [] as string[],
  hints: [] as HintDraft[],
};

function DecayPreview({ base, min, decay, fixed }: { base: number; min: number; decay: number; fixed: boolean }) {
  const data = useMemo(() => {
    const out = [];
    for (let s = 0; s <= Math.max(decay * 2, 10); s++) {
      const k = !fixed && decay > 0 && min < base ? (min - base) / (decay * decay) : 0;
      out.push({ s, v: fixed ? base : Math.max(min, Math.ceil(k * s * s + base)) });
    }
    return out;
  }, [base, min, decay, fixed]);
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <XAxis dataKey="s" stroke="var(--fg-muted)" fontSize={10} tickLine={false} />
        <YAxis stroke="var(--fg-muted)" fontSize={10} tickLine={false} domain={[0, 'dataMax']} />
        <Line type="monotone" dataKey="v" stroke="var(--accent)" dot={false} strokeWidth={2.5} isAnimationActive animationDuration={500} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Editor() {
  const { data: challenges } = useChallenges();
  const { create } = useAdminChallengeMutations();
  const upload = useUploadAttachment();
  const [files, setFiles] = useState<File[]>([]);
  const [f, setF] = useState(EMPTY);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((p) => ({ ...p, [k]: v }));

  const problems: string[] = [];
  if (f.title.trim().length < 3) problems.push('Title needs at least 3 characters');
  if (f.basePoints <= 0) problems.push('Base points must be positive');
  if (f.minPoints > f.basePoints) problems.push('Minimum points cannot exceed base points');
  if (f.decay < 1) problems.push('Decay must be at least 1');
  if (f.flagType === 'STATIC' && !f.flag.trim()) problems.push('A static challenge needs a flag');
  if (f.hints.some((h) => !h.text.trim())) problems.push('Every hint needs text');

  const submit = () => {
    const spec = {
      title: f.title.trim(),
      category: f.category,
      difficulty: f.difficulty,
      description: f.description,
      basePoints: f.basePoints,
      scoring: { strategy: f.flagType === 'DYNAMIC' && f.strategy === 'DECAY' ? 'DYNAMIC' : f.strategy, minPoints: f.minPoints, decay: f.decay },
      flagType: f.flagType,
      flag: f.flag.trim(),
      flagPrefix: f.flagPrefix || 'CTF',
      prerequisites: f.prerequisites,
      hints: f.hints.map((h) => ({ text: h.text.trim(), cost: Math.max(0, h.cost) })),
      attachments: [],
      visible: true,
    };
    create.mutate(spec, {
      onSuccess: async (c) => {
        // Files go up after the challenge exists (they are stored per challenge id).
        let failed = 0;
        for (const file of files) {
          try {
            await upload.mutateAsync({ challengeId: c.id, file });
          } catch {
            failed++;
          }
        }
        if (failed) toast.error(`${failed} file(s) failed to upload. Use the paperclip in the list to retry.`);
        toast.success(`Created "${c.title}"${files.length - failed ? ` with ${files.length - failed} file(s)` : ''}`);
        setF(EMPTY);
        setFiles([]);
        setMode('write');
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create the challenge'),
    });
  };

  return (
    <Panel title="~/admin/challenges/new" bodyClassName="space-y-7 p-7 sm:p-8">
      <Field label="Title">
        <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Hidden in Plain Sight" />
      </Field>

      <div className="space-y-6">
        <Field label="Category">
          <Segmented label="Category" value={f.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => ({ value: c, label: c[0] + c.slice(1).toLowerCase() }))} />
        </Field>
        <Field label="Difficulty">
          <Segmented label="Difficulty" value={f.difficulty} onChange={(v) => set('difficulty', v)} options={[{ value: 'EASY', label: 'Easy' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HARD', label: 'Hard' }]} />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-fg-muted">Description (markdown)</span>
          <Segmented label="Editor mode" value={mode} onChange={setMode} options={[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]} />
        </div>
        {mode === 'write' ? (
          <textarea
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={'## Heading\nExplain the puzzle. Code blocks work too:\n\n```\nexample\n```'}
            className="h-44 w-full resize-y p-4 font-mono text-sm leading-relaxed"
            aria-label="Description"
          />
        ) : (
          <div className="prose prose-sm min-h-44 rounded-2xl bg-bg p-5 shadow-nm-inset-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {f.description || '_Nothing to preview yet._'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl bg-bg p-6 shadow-nm-inset-sm">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Base points"><Input type="number" min={1} value={f.basePoints} onChange={(e) => set('basePoints', Number(e.target.value))} /></Field>
          <Field label="Minimum"><Input type="number" min={0} value={f.minPoints} onChange={(e) => set('minPoints', Number(e.target.value))} /></Field>
          <Field label="Decay solves"><Input type="number" min={1} value={f.decay} onChange={(e) => set('decay', Number(e.target.value))} /></Field>
        </div>
        <Field label="Scoring">
          <Segmented label="Scoring" value={f.strategy} onChange={(v) => set('strategy', v)} options={STRATEGIES} />
        </Field>
        <div>
          <div className="mb-1 text-xs text-fg-muted">Points as more teams solve it (preview only; the server does the real scoring)</div>
          <DecayPreview base={f.basePoints} min={f.minPoints} decay={f.decay} fixed={f.strategy === 'STATIC'} />
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Flag type">
          <Segmented label="Flag type" value={f.flagType} onChange={(v) => set('flagType', v)} options={[{ value: 'STATIC', label: 'One flag for everyone' }, { value: 'DYNAMIC', label: 'Unique flag per team' }]} />
        </Field>
        {f.flagType === 'STATIC' ? (
          <Field label="Flag" hint="Stored only as a hash. It can never be read back.">
            <div className="flex gap-3">
              <Input value={f.flag} onChange={(e) => set('flag', e.target.value)} placeholder="CTF{...}" className="font-mono" autoComplete="off" />
              <Button type="button" variant="outline" size="icon" aria-label="Generate a random flag" onClick={() => set('flag', randomFlag())}>
                <Dices size={17} />
              </Button>
            </div>
          </Field>
        ) : (
          <Field label="Flag prefix" hint="Each team gets CTF{...} derived from a server secret; sharing one is detected.">
            <Input value={f.flagPrefix} onChange={(e) => set('flagPrefix', e.target.value)} className="w-40 font-mono" />
          </Field>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-fg-muted">Hints (cost points to unlock)</span>
          <Button type="button" size="sm" variant="outline" onClick={() => set('hints', [...f.hints, { text: '', cost: 20 }])}>
            <Plus size={14} /> Add hint
          </Button>
        </div>
        {f.hints.length === 0 && <p className="text-xs text-fg-muted">No hints. Players solve it on their own.</p>}
        {f.hints.map((h, i) => (
          <div key={i} className="flex items-start gap-3">
            <Input value={h.text} onChange={(e) => set('hints', f.hints.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={`Hint ${i + 1}`} aria-label={`Hint ${i + 1} text`} />
            <Input type="number" min={0} value={h.cost} onChange={(e) => set('hints', f.hints.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x)))} className="w-24" aria-label={`Hint ${i + 1} cost`} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove hint ${i + 1}`} onClick={() => set('hints', f.hints.filter((_, j) => j !== i))}>
              <X size={16} />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-fg-muted">Files for players (optional)</span>
          <label className="nm-btn inline-flex h-8 cursor-pointer items-center gap-2 px-3.5 text-xs">
            <Paperclip size={14} /> Add files
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-fg-muted">A pcap, a binary, an image… Players see each file&apos;s size and SHA-256.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-xl bg-bg px-4 py-2.5 text-sm shadow-nm-inset-sm">
                <Paperclip size={14} className="text-fg-muted" />
                <span className="min-w-0 flex-1 truncate font-mono">{file.name}</span>
                <span className="text-xs text-fg-muted">{formatBytes(file.size)}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  <X size={15} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Requires (prerequisites)" hint="Players must solve these first. Cycles are rejected by the server.">
        <div className="flex flex-wrap gap-2.5">
          {(challenges ?? []).map((c) => (
            <ToggleChip key={c.id} active={f.prerequisites.includes(c.id)} onClick={() => set('prerequisites', f.prerequisites.includes(c.id) ? f.prerequisites.filter((x) => x !== c.id) : [...f.prerequisites, c.id])}>
              {c.title}
            </ToggleChip>
          ))}
          {challenges?.length === 0 && <span className="text-xs text-fg-muted">No other challenges yet.</span>}
        </div>
      </Field>

      {problems.length > 0 && f.title && (
        <ul className="space-y-1 text-xs text-warning">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}
      <Button className="w-full" loading={create.isPending || upload.isPending} disabled={problems.length > 0} onClick={submit}>
        Create challenge
      </Button>
    </Panel>
  );
}

function ChallengeList() {
  const { data: challenges, isLoading } = useChallenges();
  const { remove, setVisibility } = useAdminChallengeMutations();
  const upload = useUploadAttachment();
  const [q, setQ] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = (challenges ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <Panel
      title="~/admin/challenges"
      actions={<span className="text-fg-muted">{challenges?.length ?? 0} total</span>}
      bodyClassName="space-y-5 p-6"
    >
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search challenges" className="pl-10" aria-label="Search challenges" />
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState title={q ? 'No match' : 'No challenges yet'} hint="Use the editor to create the first one." />
      ) : (
        <ul className="max-h-[44rem] space-y-3 overflow-y-auto pr-1">
          {rows.map((c) => (
            <li key={c.id} className="rounded-2xl bg-bg p-4 shadow-nm-inset-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-fg">{c.title}</span>
                <CategoryBadge category={c.category} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
                <span><span className="text-accent">{c.currentPoints}</span> / {c.basePoints} pts</span>
                <span>{c.solveCount} solves</span>
                <span>{c.id}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {confirmId === c.id ? (
                    <>
                      <span className="text-danger">Delete?</span>
                      <Button size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate(c.id, { onSuccess: () => { toast.success('Challenge deleted'); setConfirmId(null); }, onError: () => toast.error('Delete failed') })}>
                        Yes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>No</Button>
                    </>
                  ) : (
                    <>
                      <label
                        title="Attach a file"
                        className="nm-btn nm-btn-ghost inline-grid h-10 w-10 cursor-pointer place-items-center !rounded-full"
                      >
                        <Paperclip size={16} />
                        <span className="sr-only">Attach a file to {c.title}</span>
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            upload.mutate(
                              { challengeId: c.id, file },
                              {
                                onSuccess: (a) => toast.success(`Attached ${a.name} (${formatBytes(a.size)})`),
                                onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Upload failed'),
                              },
                            );
                          }}
                        />
                      </label>
                      <Button size="icon" variant="ghost" aria-label={`Hide ${c.title}`} title="Hide from players" onClick={() => setVisibility.mutate({ id: c.id, visible: false }, { onSuccess: () => toast.success('Hidden from players') })}>
                        <EyeOff size={16} />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Show ${c.title}`} title="Show to players" onClick={() => setVisibility.mutate({ id: c.id, visible: true }, { onSuccess: () => toast.success('Visible to players') })}>
                        <Eye size={16} />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${c.title}`} onClick={() => setConfirmId(c.id)}>
                        <Trash2 size={16} className="text-danger" />
                      </Button>
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function ChallengesTab() {
  return (
    <div className="grid items-start gap-8 2xl:grid-cols-[1.25fr_1fr]">
      <Editor />
      <ChallengeList />
    </div>
  );
}
