import { formatDistanceToNow } from 'date-fns';
import { AlertOctagon, Info, Megaphone, Send, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { useAnnouncements, usePostAnnouncement } from '../../api/hooks';
import type { Severity } from '../../api/types';
import { Panel } from '../../components/Panel';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { Field, Segmented } from './shared';
import { SEVERITY_COLOR } from './util';

const ICON: Record<Severity, LucideIcon> = { INFO: Info, WARNING: TriangleAlert, CRITICAL: AlertOctagon };

function Banner({ title, body, severity }: { title: string; body: string; severity: Severity }) {
  const Icon = ICON[severity];
  const color = SEVERITY_COLOR[severity];
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-bg p-5 shadow-nm-inset-sm">
      <span className="mt-0.5 shrink-0" style={{ color }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-fg">{title}</div>
        <div className="mt-1 text-sm text-fg-muted">{body}</div>
      </div>
    </div>
  );
}

export default function AnnounceTab() {
  const post = usePostAnnouncement();
  const { data: history, isLoading } = useAnnouncements();
  const [t, setT] = useState({ title: '', body: '', severity: 'INFO' as Severity });

  return (
    <div className="grid items-start gap-8 xl:grid-cols-2">
      <Panel title="~/admin/announce" bodyClassName="space-y-6 p-7 sm:p-8">
        <Field label="Title">
          <Input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="e.g. New challenges unlocked" maxLength={80} />
        </Field>
        <Field label="Message">
          <textarea value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} placeholder="What do players need to know?" className="h-32 w-full resize-y p-4 text-sm" aria-label="Message" />
        </Field>
        <Field label="Severity">
          <Segmented
            label="Severity"
            value={t.severity}
            onChange={(v) => setT({ ...t, severity: v })}
            options={[
              { value: 'INFO', label: 'Info', icon: Info },
              { value: 'WARNING', label: 'Warning', icon: TriangleAlert },
              { value: 'CRITICAL', label: 'Critical', icon: AlertOctagon },
            ]}
          />
        </Field>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-fg-muted">Preview</div>
          <Banner title={t.title || 'Your title appears here'} body={t.body || 'Your message appears here.'} severity={t.severity} />
        </div>

        <Button
          className="w-full"
          loading={post.isPending}
          disabled={!t.title.trim()}
          onClick={() =>
            post.mutate(t, {
              onSuccess: () => {
                toast.success('Announcement posted');
                setT({ title: '', body: '', severity: 'INFO' });
              },
              onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not post'),
            })
          }
        >
          <Send size={16} /> Post announcement
        </Button>
      </Panel>

      <Panel title="~/admin/announcements/history" bodyClassName="space-y-4 p-7">
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !history || history.length === 0 ? (
          <EmptyState icon={<Megaphone size={32} />} title="Nothing announced yet" hint="Posted announcements appear here and as a notice for every player." />
        ) : (
          history.map((a) => (
            <div key={a.id} className="space-y-1.5">
              <Banner title={a.title} body={a.body} severity={a.severity} />
              <div className="pl-2 text-xs text-fg-muted">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</div>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
