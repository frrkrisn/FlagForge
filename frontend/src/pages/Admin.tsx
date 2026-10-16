import { motion } from 'framer-motion';
import {
  Flag,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Radio,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAlerts, useMe } from '../api/hooks';
import { Panel, Prompt } from '../components/Panel';
import { Skeleton } from '../components/ui';
import { cn } from '../lib/cn';
import AlertsTab from './admin/AlertsTab';
import AnnounceTab from './admin/AnnounceTab';
import ChallengesTab from './admin/ChallengesTab';
import EventTab from './admin/EventTab';
import Overview from './admin/Overview';
import SubmissionsTab from './admin/SubmissionsTab';
import TeamsTab from './admin/TeamsTab';

const TABS: { id: string; label: string; icon: LucideIcon; render: () => JSX.Element }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, render: () => <Overview /> },
  { id: 'event', label: 'Event', icon: Radio, render: () => <EventTab /> },
  { id: 'challenges', label: 'Challenges', icon: Flag, render: () => <ChallengesTab /> },
  { id: 'teams', label: 'Teams', icon: Users, render: () => <TeamsTab /> },
  { id: 'submissions', label: 'Submissions', icon: ListChecks, render: () => <SubmissionsTab /> },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, render: () => <AlertsTab /> },
  { id: 'announce', label: 'Announce', icon: Megaphone, render: () => <AnnounceTab /> },
];

export default function Admin() {
  const { data: me, isLoading } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  const { data: alerts } = useAlerts(isAdmin);
  const [params, setParams] = useSearchParams();

  if (isLoading) return <Skeleton className="h-96" />;
  if (!me || !isAdmin)
    return (
      <div className="mx-auto max-w-lg py-16">
        <Panel title="~/403">
          <p className="text-danger">permission denied: admin access required</p>
          <Link to="/" className="mt-3 inline-block text-accent">
            ← back home
          </Link>
        </Panel>
      </div>
    );

  const active = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0];
  const openAlerts = alerts?.filter((a) => a.status === 'OPEN').length ?? 0;

  return (
    <div className="space-y-8">
      <Prompt cursor className="text-3xl">
        sudo admin
      </Prompt>

      <div className="grid items-start gap-8 lg:grid-cols-[15rem_1fr]">
        <nav
          aria-label="Admin sections"
          className="flex gap-2 overflow-x-auto rounded-3xl bg-panel p-3 shadow-nm-raised lg:sticky lg:top-28 lg:flex-col lg:overflow-visible"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const on = id === active.id;
            return (
              <button
                key={id}
                onClick={() => setParams(id === 'overview' ? {} : { tab: id })}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-all duration-200',
                  on ? 'bg-bg text-accent shadow-nm-inset-sm' : 'text-fg-muted hover:text-fg hover:shadow-nm-raised-sm',
                )}
              >
                <Icon size={17} />
                {label}
                {id === 'alerts' && openAlerts > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-bg">
                    {openAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          {active.render()}
        </motion.div>
      </div>
    </div>
  );
}
