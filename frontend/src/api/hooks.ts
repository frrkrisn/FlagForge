import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  AdminSubmission,
  Alert,
  Announcement,
  ChallengeDetail,
  ChallengeListItem,
  EventStatus,
  FeedEvent,
  Me,
  Scoreboard,
  SubmitOutcome,
  Team,
  TimelineTeam,
  UserPublic,
} from './types';

export const keys = {
  me: ['me'] as const,
  eventStatus: ['event', 'status'] as const,
  challenges: ['challenges'] as const,
  challenge: (id: string) => ['challenges', id] as const,
  scoreboard: ['scoreboard'] as const,
  timeline: (top: number) => ['scoreboard', 'timeline', top] as const,
  feed: ['feed'] as const,
  announcements: ['announcements'] as const,
  myTeam: ['teams', 'me'] as const,
  team: (id: string) => ['teams', id] as const,
  player: (id: string) => ['users', id] as const,
  adminScoreboard: ['admin', 'scoreboard'] as const,
  submissions: (q: string) => ['admin', 'submissions', q] as const,
  alerts: ['admin', 'alerts'] as const,
};

// ---- queries ----
export function useMe(options?: Partial<UseQueryOptions<Me | null>>) {
  return useQuery<Me | null>({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.get<Me>('/auth/me');
      } catch {
        return null; // unauthenticated
      }
    },
    staleTime: 30_000,
    ...options,
  });
}

export function useEventStatus() {
  return useQuery<EventStatus>({
    queryKey: keys.eventStatus,
    queryFn: () => api.get<EventStatus>('/event/status'),
    refetchInterval: 15_000,
  });
}

export function useChallenges() {
  return useQuery<ChallengeListItem[]>({
    queryKey: keys.challenges,
    queryFn: async () => (await api.get<{ challenges: ChallengeListItem[] }>('/challenges')).challenges,
    refetchInterval: 20_000,
  });
}

export function useChallenge(id: string, enabled = true) {
  return useQuery<ChallengeDetail>({
    queryKey: keys.challenge(id),
    queryFn: () => api.get<ChallengeDetail>(`/challenges/${id}`),
    enabled,
  });
}

export function useScoreboard() {
  return useQuery<Scoreboard>({
    queryKey: keys.scoreboard,
    queryFn: () => api.get<Scoreboard>('/scoreboard'),
    refetchInterval: 5_000,
  });
}

export function useTimeline(top = 10) {
  return useQuery<TimelineTeam[]>({
    queryKey: keys.timeline(top),
    queryFn: async () => (await api.get<{ teams: TimelineTeam[] }>(`/scoreboard/timeline?top=${top}`)).teams,
    refetchInterval: 30_000,
  });
}

export function useFeed() {
  return useQuery<FeedEvent[]>({
    queryKey: keys.feed,
    queryFn: async () => (await api.get<{ events: FeedEvent[] }>('/feed?since=0')).events,
    refetchInterval: 5_000,
  });
}

export function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: keys.announcements,
    queryFn: async () => (await api.get<{ announcements: Announcement[] }>('/announcements')).announcements,
    refetchInterval: 30_000,
  });
}

export function useMyTeam(enabled = true) {
  return useQuery<Team | null>({
    queryKey: keys.myTeam,
    queryFn: async () => {
      try {
        return await api.get<Team>('/teams/me');
      } catch {
        return null;
      }
    },
    enabled,
  });
}

export function useTeam(id: string) {
  return useQuery<Team>({ queryKey: keys.team(id), queryFn: () => api.get<Team>(`/teams/${id}`) });
}

export function usePlayer(id: string) {
  return useQuery<UserPublic>({ queryKey: keys.player(id), queryFn: () => api.get<UserPublic>(`/users/${id}`) });
}

// ---- auth mutations ----
export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { username: string; email: string; password: string }) =>
      api.post<{ user: Me }>('/auth/register', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { username: string; password: string }) => api.post<{ user: Me }>('/auth/login', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => qc.clear(),
  });
}

// ---- team mutations ----
function useTeamMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.myTeam });
      qc.invalidateQueries({ queryKey: keys.me });
      qc.invalidateQueries({ queryKey: keys.scoreboard });
    },
  });
}
export const useCreateTeam = () => useTeamMutation((b: { name: string }) => api.post<Team>('/teams', b));
export const useJoinTeam = () => useTeamMutation((b: { inviteCode: string }) => api.post<Team>('/teams/join', b));
export const useLeaveTeam = () => useTeamMutation(() => api.post('/teams/leave'));
export const useKick = () => useTeamMutation((b: { playerId: string }) => api.post<Team>('/teams/me/kick', b));
export const useRegenInvite = () =>
  useTeamMutation(() => api.post<{ inviteCode: string }>('/teams/me/invite/regenerate'));

// ---- challenge actions ----
export function useSubmitFlag(challengeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (flag: string) => api.post<SubmitOutcome>(`/challenges/${challengeId}/submit`, { flag }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.challenges });
      qc.invalidateQueries({ queryKey: keys.challenge(challengeId) });
      qc.invalidateQueries({ queryKey: keys.scoreboard });
      qc.invalidateQueries({ queryKey: keys.myTeam });
      qc.invalidateQueries({ queryKey: keys.feed });
    },
  });
}

export function useUnlockHint(challengeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hintId: string) =>
      api.post<{ hintId: string; text: string; cost: number; newTeamScore: number }>(
        `/challenges/${challengeId}/hints/${hintId}/unlock`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.challenge(challengeId) });
      qc.invalidateQueries({ queryKey: keys.scoreboard });
      qc.invalidateQueries({ queryKey: keys.myTeam });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { bio?: string; avatarSeed?: string; themePrefs?: string }) =>
      api.patch<Me>('/users/me', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

// ---- admin ----
export function useAdminScoreboard(enabled: boolean) {
  return useQuery<Scoreboard['rows']>({
    queryKey: keys.adminScoreboard,
    queryFn: async () => (await api.get<{ rows: Scoreboard['rows'] }>('/admin/scoreboard')).rows,
    enabled,
    refetchInterval: 5_000,
  });
}

export function useSubmissions(query: string, enabled: boolean) {
  return useQuery<AdminSubmission[]>({
    queryKey: keys.submissions(query),
    queryFn: async () => (await api.get<{ submissions: AdminSubmission[] }>(`/admin/submissions${query}`)).submissions,
    enabled,
    refetchInterval: 8_000,
  });
}

export function useAlerts(enabled: boolean) {
  return useQuery<Alert[]>({
    queryKey: keys.alerts,
    queryFn: async () => (await api.get<{ alerts: Alert[] }>('/admin/alerts')).alerts,
    enabled,
    refetchInterval: 8_000,
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/alerts/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.alerts }),
  });
}

/** Demo-only: reveal a team's per-team dynamic flag (admin). */
export function useRevealFlag() {
  return useMutation({
    mutationFn: (b: { teamId: string; challengeId: string }) =>
      api.get<{ flag: string }>(`/admin/teams/${b.teamId}/flag/${b.challengeId}`),
  });
}

export function useEventControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'start' | 'pause' | 'resume' | 'end') =>
      api.post<EventStatus>(`/admin/event/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.eventStatus }),
  });
}

export function useSetFreeze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (freezeAt: string) => api.post<EventStatus>('/admin/event/freeze', { freezeAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.eventStatus }),
  });
}

export function useAdminChallengeMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.challenges });
    qc.invalidateQueries({ queryKey: keys.adminScoreboard });
  };
  return {
    create: useMutation({
      mutationFn: (spec: unknown) => api.post<ChallengeDetail>('/admin/challenges', spec),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.del(`/admin/challenges/${id}`),
      onSuccess: invalidate,
    }),
    setVisibility: useMutation({
      mutationFn: (b: { id: string; visible: boolean }) =>
        api.post(`/admin/challenges/${b.id}/visibility`, { visible: b.visible }),
      onSuccess: invalidate,
    }),
  };
}

export function usePostAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { title: string; body: string; severity: string }) =>
      api.post<Announcement>('/admin/announcements', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.announcements }),
  });
}
