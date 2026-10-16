import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCheck, Flame, ShieldAlert, ShieldCheck, Skull, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAlerts, useDismissAlert } from '../../api/hooks';
import { Panel } from '../../components/Panel';
import { Button, EmptyState, Skeleton } from '../../components/ui';
import { Segmented } from './shared';
import { SEVERITY_COLOR, alertSeverity } from './util';

const KIND: Record<string, { label: string; icon: LucideIcon; blurb: string }> = {
  FLAG_SHARING: { label: 'Flag sharing', icon: Skull, blurb: 'A team submitted another team’s unique flag.' },
  BURST_SUBMISSIONS: { label: 'Submission burst', icon: Flame, blurb: 'Unusually many submissions in a minute.' },
  SAME_WRONG_FLAG_MULTI_TEAM: { label: 'Identical wrong flag', icon: ShieldAlert, blurb: 'Several teams sent the same wrong answer.' },
};

export default function AlertsTab() {
  const { data, isLoading } = useAlerts(true);
  const dismiss = useDismissAlert();
  const [filter, setFilter] = useState<'OPEN' | 'DISMISSED' | 'ALL'>('OPEN');

  const all = [...(data ?? [])].reverse();
  const list = all.filter((a) => filter === 'ALL' || a.status === filter);
  const open = all.filter((a) => a.status === 'OPEN').length;

  return (
    <Panel
      title="~/admin/alerts"
      actions={<span className={open ? 'text-danger' : 'text-success'}>{open} open</span>}
      bodyClassName="space-y-7 p-7 sm:p-8"
    >
      <Segmented
        label="Alert filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'OPEN', label: `Open (${open})` },
          { value: 'DISMISSED', label: 'Dismissed' },
          { value: 'ALL', label: 'All' },
        ]}
      />

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={34} />}
          title={filter === 'OPEN' ? 'No open alerts' : 'Nothing here'}
          hint="Flag sharing, submission bursts and shared wrong answers are flagged automatically."
        />
      ) : (
        <ul className="space-y-5">
          <AnimatePresence initial={false}>
            {list.map((a) => {
              const meta = KIND[a.kind] ?? { label: a.kind, icon: ShieldAlert, blurb: '' };
              const color = SEVERITY_COLOR[alertSeverity(a.kind)];
              const Icon = meta.icon;
              const isOpen = a.status === 'OPEN';
              return (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: isOpen ? 1 : 0.6, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-wrap items-start gap-5 rounded-3xl bg-bg p-6 shadow-nm-inset-sm"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-panel shadow-nm-raised-sm" style={{ color }}>
                    <Icon size={22} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-fg">{meta.label}</span>
                      <span className="rounded-full bg-panel px-2.5 py-0.5 text-[10px] uppercase tracking-wider shadow-nm-inset-sm" style={{ color }}>
                        {alertSeverity(a.kind).toLowerCase()}
                      </span>
                      <span className="text-xs text-fg-muted">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-fg">{a.evidence}</p>
                    {meta.blurb && <p className="text-xs text-fg-muted">{meta.blurb}</p>}
                  </div>
                  {isOpen ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={dismiss.isPending && dismiss.variables === a.id}
                      onClick={() => dismiss.mutate(a.id, { onSuccess: () => toast.success('Alert dismissed') })}
                    >
                      <CheckCheck size={14} /> Dismiss
                    </Button>
                  ) : (
                    <span className="text-xs text-fg-muted">dismissed</span>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  );
}
