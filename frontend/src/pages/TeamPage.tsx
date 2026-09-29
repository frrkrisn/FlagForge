import { Copy, Crown, LogOut, RefreshCw, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../api/client';
import {
  useCreateTeam,
  useJoinTeam,
  useKick,
  useLeaveTeam,
  useMe,
  useMyTeam,
  useRegenInvite,
} from '../api/hooks';
import { Panel, Prompt } from '../components/Panel';
import { TeamAvatar } from '../components/TeamAvatar';
import { Button, EmptyState, Input, Skeleton } from '../components/ui';

function CreateOrJoin() {
  const create = useCreateTeam();
  const join = useJoinTeam();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Failed');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="~/team/create">
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">Start a team and become its captain.</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="team name" />
          <Button
            className="w-full"
            loading={create.isPending}
            onClick={() => create.mutate({ name }, { onError: err })}
            disabled={name.length < 3}
          >
            Create team
          </Button>
        </div>
      </Panel>
      <Panel title="~/team/join">
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">Have an invite code from a teammate?</p>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="INVITE CODE" className="font-mono uppercase" />
          <Button
            variant="outline"
            className="w-full"
            loading={join.isPending}
            onClick={() => join.mutate({ inviteCode: code }, { onError: err })}
            disabled={!code}
          >
            Join team
          </Button>
        </div>
      </Panel>
    </div>
  );
}

export default function TeamPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const { data: team, isLoading } = useMyTeam(!!me);
  const leave = useLeaveTeam();
  const kick = useKick();
  const regen = useRegenInvite();
  const navigate = useNavigate();

  if (meLoading || isLoading) return <Skeleton className="h-64" />;
  if (!me)
    return (
      <EmptyState
        title="Sign in to manage your team"
        action={<Link to="/login"><Button size="sm">Log in</Button></Link>}
      />
    );

  if (!team) {
    return (
      <div className="space-y-6">
        <Prompt cursor className="text-2xl">team --init</Prompt>
        <CreateOrJoin />
      </div>
    );
  }

  const isCaptain = team.captainId === me.id;
  return (
    <div className="space-y-6">
      <Prompt cursor className="text-2xl">whoami --team</Prompt>
      <Panel
        title={`~/teams/${team.id}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => leave.mutate(undefined, { onSuccess: () => navigate('/team') })}>
            <LogOut size={14} /> leave
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <TeamAvatar seed={team.name} size={56} />
          <div>
            <div className="font-mono text-xl text-fg">{team.name}</div>
            <div className="text-sm text-fg-muted">
              rank #{team.rank} · {team.score} pts · {team.solves} solves
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-fg-muted">invite</span>
            <code className="rounded border border-border bg-overlay px-2 py-1 font-mono text-accent">{team.inviteCode}</code>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy invite code"
              onClick={() => {
                navigator.clipboard?.writeText(team.inviteCode ?? '');
                toast.success('Copied');
              }}
            >
              <Copy size={16} />
            </Button>
            {isCaptain && (
              <Button variant="ghost" size="icon" aria-label="Regenerate invite" onClick={() => regen.mutate(undefined)}>
                <RefreshCw size={16} />
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="~/team/members">
        <ul className="divide-y divide-border">
          {team.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <TeamAvatar seed={m.avatarSeed} size={28} />
              <Link to={`/players/${m.id}`} className="font-mono text-fg hover:text-accent">
                {m.username}
              </Link>
              {m.isCaptain && <Crown size={14} className="text-warning" aria-label="Captain" />}
              <span className="ml-auto text-xs text-fg-muted">{m.personalSolves} solves</span>
              {isCaptain && !m.isCaptain && (
                <Button variant="ghost" size="icon" aria-label={`Kick ${m.username}`} onClick={() => kick.mutate({ playerId: m.id })}>
                  <UserMinus size={16} className="text-danger" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
