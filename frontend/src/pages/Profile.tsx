import { Link, useParams } from 'react-router-dom';
import { usePlayer, useTeam } from '../api/hooks';
import { Panel } from '../components/Panel';
import { TeamAvatar } from '../components/TeamAvatar';
import { SkillRadar, BadgeList } from '../components/SkillRadar';
import { EmptyState, Skeleton } from '../components/ui';

function TeamProfile({ id }: { id: string }) {
  const { data: team, isLoading, isError } = useTeam(id);
  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !team) return <EmptyState title="Team not found" />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Panel title={`~/teams/${team.id}`}>
        <div className="flex items-center gap-4">
          <TeamAvatar seed={team.name} size={64} />
          <div>
            <div className="font-mono text-2xl text-fg">{team.name}</div>
            <div className="text-sm text-fg-muted">rank #{team.rank} · {team.score} pts · {team.solves} solves</div>
          </div>
        </div>
      </Panel>
      <Panel title="~/skills"><SkillRadar skills={team.skills} /></Panel>
      <Panel title="~/badges"><BadgeList badges={team.badges} /></Panel>
      <Panel title="~/team/members">
        <ul className="space-y-1">
          {team.members.map((m) => (
            <li key={m.id}>
              <Link to={`/players/${m.id}`} className="font-mono text-fg hover:text-accent">
                {m.username}
              </Link>
              {m.isCaptain && <span className="ml-2 text-xs text-warning">captain</span>}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function PlayerProfile({ id }: { id: string }) {
  const { data: user, isLoading, isError } = usePlayer(id);
  if (isLoading) return <Skeleton className="h-64" />;
  if (isError || !user) return <EmptyState title="Player not found" />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Panel title={`~/players/${user.id}`}>
        <div className="flex items-center gap-4">
          <TeamAvatar seed={user.avatarSeed} size={64} />
          <div>
            <div className="font-mono text-2xl text-fg">{user.username}</div>
            <div className="text-sm text-fg-muted">
              {user.role === 'ADMIN' ? 'Event admin' : `${user.personalSolves} solves`}
              {user.teamId && (
                <>
                  {' · '}
                  <Link to={`/teams/${user.teamId}`} className="text-accent">team</Link>
                </>
              )}
            </div>
          </div>
        </div>
        {user.bio && <p className="mt-4 text-sm text-fg-muted">{user.bio}</p>}
      </Panel>
      <Panel title="~/skills"><SkillRadar skills={user.skills} /></Panel>
      <Panel title="~/badges"><BadgeList badges={user.badges} /></Panel>
    </div>
  );
}

export default function Profile({ kind }: { kind: 'team' | 'player' }) {
  const { id = '' } = useParams();
  return kind === 'team' ? <TeamProfile id={id} /> : <PlayerProfile id={id} />;
}
