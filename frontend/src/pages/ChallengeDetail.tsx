import confetti from 'canvas-confetti';
import { ArrowLeft, Check, Download, FileDown, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate, useParams } from 'react-router-dom';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { ApiError } from '../api/client';
import { useChallenge, useSubmitFlag, useUnlockHint } from '../api/hooks';
import type { Hint, SubmitOutcome } from '../api/types';
import { CategoryBadge, DifficultyBadge, PointsBadge } from '../components/domain';
import { formatBytes, shortHash } from '../lib/format';
import { Panel } from '../components/Panel';
import { CopyButton } from './admin/shared';
import { Button, Input, Skeleton } from '../components/ui';
import { cn } from '../lib/cn';

function HintRow({ hint, challengeId }: { hint: Hint; challengeId: string }) {
  const unlock = useUnlockHint(challengeId);
  const [confirming, setConfirming] = useState(false);
  if (hint.unlocked) {
    return (
      <div className="rounded-2xl bg-bg p-4 text-sm shadow-nm-inset-sm">
        <span className="text-fg-muted">hint:</span> <span className="text-fg">{hint.text}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-2xl bg-panel p-4 text-sm shadow-nm-raised-sm">
      <span className="text-fg-muted">
        <Lock size={12} className="mr-1 inline" />
        Costs <span className="text-warning">−{hint.cost}</span> pts
      </span>
      {confirming ? (
        <span className="flex items-center gap-2">
          <Button size="sm" variant="danger" loading={unlock.isPending} onClick={() => unlock.mutate(hint.id)}>
            Unlock for −{hint.cost}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            cancel
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Unlock hint
        </Button>
      )}
    </div>
  );
}

type SubState = 'idle' | 'wrong' | 'cooldown' | 'solved' | 'closed' | 'locked';

export default function ChallengeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: c, isLoading, isError } = useChallenge(id);
  const submit = useSubmitFlag(id);
  const { register, handleSubmit, reset, setValue } = useForm<{ flag: string }>();
  const [state, setState] = useState<SubState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate('/challenges');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => setCooldownLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  useEffect(() => {
    if (c?.solved) setState('solved');
  }, [c?.solved]);

  const handleOutcome = (o: SubmitOutcome) => {
    if (o.result === 'CORRECT') {
      setState('solved');
      confetti({ particleCount: o.firstBlood ? 200 : 90, spread: o.firstBlood ? 110 : 70, origin: { y: 0.7 } });
      toast.success(o.firstBlood ? `🩸 FIRST BLOOD! +${o.awardedPoints} pts` : `[ OK ] Correct! +${o.awardedPoints} pts`);
      reset();
    } else if (o.result === 'WRONG') {
      setState('wrong');
      setMessage(`Wrong flag. ${o.attemptsLeft ?? 0} attempts left before cooldown.`);
      if (o.cooldownSecondsLeft) {
        setState('cooldown');
        setCooldownLeft(o.cooldownSecondsLeft);
      }
    } else if (o.result === 'ALREADY_SOLVED') {
      setState('solved');
    } else if (o.result === 'FLAG_SHARING') {
      setState('wrong');
      setMessage('That flag belongs to another team. This has been reported.');
      toast.error('[FAIL] Flag sharing detected');
    }
  };

  const onSubmit = handleSubmit(async ({ flag }) => {
    setMessage(null);
    try {
      handleOutcome(await submit.mutateAsync(flag.trim()));
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'COOLDOWN') {
          setState('cooldown');
          setMessage('On cooldown — wait before retrying.');
          if (!cooldownLeft) setCooldownLeft(30);
        } else if (e.code === 'LOCKED') {
          setState('locked');
          setMessage(e.message);
        } else if (e.code === 'CLOSED') {
          setState('closed');
          setMessage('The competition is not running.');
        } else {
          setMessage(e.message);
        }
      }
    }
  });

  const solvedView = useMemo(() => c?.solved || state === 'solved', [c?.solved, state]);

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  if (isError || !c)
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/challenges" className="text-accent">
          ← back
        </Link>
        <p className="mt-4 text-danger">Could not load this challenge.</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/challenges" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={14} /> challenges
      </Link>
      <Panel title={`~/challenges/${c.category.toLowerCase()}/${c.id}`}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-mono text-2xl text-fg">{c.title}</h1>
            <PointsBadge current={c.currentPoints} base={c.basePoints} min={c.minPoints} className="text-lg" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={c.category} />
            <DifficultyBadge difficulty={c.difficulty} />
            <span className="text-xs text-fg-muted">{c.solveCount} solves</span>
          </div>

          <div className="prose prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeHighlight]}>
              {c.description || '_No description._'}
            </ReactMarkdown>
          </div>

          {c.attachments.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wider text-fg-muted">Files</div>
              {c.attachments.map((a) => (
                <div key={a.name} className="flex flex-wrap items-center gap-4 rounded-2xl bg-bg p-4 shadow-nm-inset-sm">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-panel text-accent shadow-nm-raised-sm">
                    <FileDown size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-fg">{a.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
                      <span>{formatBytes(a.size)}</span>
                      {a.sha256 && (
                        <span title={a.sha256} className="font-mono">
                          sha256 {shortHash(a.sha256)}
                        </span>
                      )}
                    </div>
                  </div>
                  {a.sha256 && <CopyButton text={a.sha256} label="Copy hash" />}
                  <a
                    href={`/api/challenges/${c.id}/files/${encodeURIComponent(a.name)}`}
                    download={a.name}
                    className="nm-btn nm-btn-primary inline-flex h-9 items-center gap-2 px-4 text-xs font-medium"
                  >
                    <Download size={14} /> Download
                  </a>
                </div>
              ))}
              <p className="text-xs text-fg-muted">
                Verify your download with the SHA-256 above (<code className="text-fg">sha256sum {c.attachments[0].name}</code>).
              </p>
            </div>
          )}
        </div>
      </Panel>

      {c.hints.length > 0 && (
        <Panel title="~/hints">
          <div className="space-y-2">
            {c.hints.map((h) => (
              <HintRow key={h.id} hint={h} challengeId={c.id} />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="~/submit">
        {solvedView ? (
          <div className="flex items-center gap-2 text-accent">
            <Check size={18} /> Your team has solved this challenge.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-2">
            <div className={cn('flex gap-2', state === 'wrong' && 'animate-flag-shake')}>
              <Input
                {...register('flag')}
                placeholder="CTF{...}"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                aria-label="Flag"
                onPaste={(e) => setTimeout(() => setValue('flag', e.currentTarget.value.trim()), 0)}
              />
              <Button type="submit" loading={submit.isPending} disabled={state === 'cooldown' && cooldownLeft > 0}>
                {state === 'cooldown' && cooldownLeft > 0 ? `wait ${cooldownLeft}s` : 'Submit'}
              </Button>
            </div>
            {message && (
              <p className={cn('text-sm', state === 'wrong' || state === 'closed' || state === 'locked' ? 'text-danger' : 'text-warning')}>
                {message}
              </p>
            )}
          </form>
        )}
      </Panel>

      {c.recentSolvers.length > 0 && (
        <Panel title="~/recent-solvers">
          <ul className="space-y-1 text-sm">
            {c.recentSolvers.map((s) => (
              <li key={s.teamId} className="flex justify-between">
                <Link to={`/teams/${s.teamId}`} className="text-fg hover:text-accent">
                  {s.teamName}
                </Link>
                <span className="text-fg-muted">{new Date(s.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
