import { format } from 'date-fns';
import { Flag, Pause, Play, RotateCcw, Snowflake } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { useEventControl, useEventStatus, useSetFreeze } from '../../api/hooks';
import type { EventState } from '../../api/types';
import { Countdown } from '../../components/domain';
import { Panel } from '../../components/Panel';
import { Button, Input, Skeleton } from '../../components/ui';
import { cn } from '../../lib/cn';
import { Field } from './shared';

const STATE_COLOR: Record<EventState, string> = {
  RUNNING: 'var(--success)',
  PAUSED: 'var(--warning)',
  NOT_STARTED: 'var(--fg-muted)',
  ENDED: 'var(--danger)',
};

const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Something went wrong');

export default function EventTab() {
  const { data } = useEventStatus();
  const control = useEventControl();
  const freeze = useSetFreeze();
  const [endText, setEndText] = useState('');
  const [freezeAt, setFreezeAt] = useState('');

  if (!data) return <Skeleton className="h-96" />;

  const run = (action: 'start' | 'pause' | 'resume' | 'end', ok: string) =>
    control.mutate(action, { onSuccess: () => toast.success(ok), onError: err });

  const setFreezeIso = (iso: string) =>
    freeze.mutate(iso, { onSuccess: () => toast.success('Freeze time saved'), onError: err });

  const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const color = STATE_COLOR[data.state];
  const canStart = data.state === 'NOT_STARTED' || data.state === 'PAUSED';

  return (
    <div className="grid gap-8 xl:grid-cols-[1.1fr_1fr]">
      <Panel title="~/admin/event" bodyClassName="space-y-8 p-8">
        <div className="flex flex-wrap items-center gap-6">
          <span
            className="grid h-24 w-24 place-items-center rounded-full bg-bg shadow-nm-inset"
            style={{ color, boxShadow: `var(--nm-inset), 0 0 22px color-mix(in srgb, ${color} 35%, transparent)` }}
          >
            <span className="h-5 w-5 animate-pulse rounded-full" style={{ background: color }} />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wider text-fg-muted">Current state</div>
            <div className="font-mono text-4xl tracking-tight" style={{ color }}>
              {data.state.replace('_', ' ')}
            </div>
            <div className="mt-1 text-sm text-fg-muted">
              {data.state === 'RUNNING' && data.endAt ? (
                <>ends in <Countdown target={data.endAt} serverNow={data.serverTime} /></>
              ) : data.startAt ? (
                <>started {format(new Date(data.startAt), 'PPp')}</>
              ) : (
                'not started yet'
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button loading={control.isPending} disabled={!canStart || control.isPending} onClick={() => run(data.state === 'PAUSED' ? 'resume' : 'start', data.state === 'PAUSED' ? 'Event resumed' : 'Event started')}>
            {data.state === 'PAUSED' ? <RotateCcw size={16} /> : <Play size={16} />}
            {data.state === 'PAUSED' ? 'Resume' : 'Start event'}
          </Button>
          <Button variant="outline" disabled={data.state !== 'RUNNING' || control.isPending} onClick={() => run('pause', 'Event paused')}>
            <Pause size={16} /> Pause
          </Button>
        </div>

        <div className="rounded-3xl bg-bg p-6 shadow-nm-inset-sm">
          <div className="mb-1 flex items-center gap-2 font-mono text-sm text-danger">
            <Flag size={15} /> End the event
          </div>
          <p className="mb-4 text-xs text-fg-muted">
            This closes submissions for everyone and reveals the final standings. It cannot be undone. Type <code className="text-fg">END</code> to confirm.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={endText} onChange={(e) => setEndText(e.target.value)} placeholder="type END" className="w-44" aria-label="Type END to confirm" />
            <Button variant="danger" disabled={endText !== 'END' || data.state === 'ENDED' || control.isPending} onClick={() => { run('end', 'Event ended'); setEndText(''); }}>
              End event
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="~/admin/freeze" bodyClassName="space-y-6 p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-bg text-info shadow-nm-inset-sm">
            <Snowflake size={22} />
          </span>
          <p className="text-sm text-fg-muted">
            After the freeze time the <span className="text-fg">public</span> scoreboard stops updating, so the finish stays a surprise. The admin board always stays live.
          </p>
        </div>

        <div className="rounded-2xl bg-bg px-5 py-4 text-sm shadow-nm-inset-sm">
          {data.freezeAt ? (
            <>
              Freeze at <span className="font-mono text-fg">{format(new Date(data.freezeAt), 'PPp')}</span>{' '}
              <span className={cn('ml-1', data.frozen ? 'text-info' : 'text-fg-muted')}>({data.frozen ? 'frozen now ❄' : 'scheduled'})</span>
            </>
          ) : (
            <span className="text-fg-muted">No freeze scheduled.</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {[[1, 'in 1 hour'], [6, 'in 6 hours'], [24, 'in 24 hours']].map(([h, label]) => (
            <Button key={label} size="sm" variant="outline" disabled={freeze.isPending} onClick={() => setFreezeIso(inHours(h as number))}>
              {label}
            </Button>
          ))}
          <Button size="sm" variant="outline" disabled={freeze.isPending} onClick={() => setFreezeIso(new Date().toISOString())}>
            freeze now
          </Button>
        </div>

        <Field label="Or pick an exact time">
          <div className="flex flex-wrap gap-3">
            <input
              type="datetime-local"
              value={freezeAt}
              onChange={(e) => setFreezeAt(e.target.value)}
              className="h-11 rounded-xl px-4 text-sm text-fg"
              aria-label="Freeze time"
            />
            <Button disabled={!freezeAt || freeze.isPending} loading={freeze.isPending} onClick={() => setFreezeIso(new Date(freezeAt).toISOString())}>
              Set freeze
            </Button>
          </div>
        </Field>
        <p className="text-xs text-fg-muted">Server time: {format(new Date(data.serverTime), 'PPpp')}</p>
      </Panel>
    </div>
  );
}
