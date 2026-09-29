import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';

const Landing = lazy(() => import('../pages/Landing'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const Challenges = lazy(() => import('../pages/Challenges'));
const ChallengeDetail = lazy(() => import('../pages/ChallengeDetail'));
const ScoreboardPage = lazy(() => import('../pages/ScoreboardPage'));
const TeamPage = lazy(() => import('../pages/TeamPage'));
const Rules = lazy(() => import('../pages/Rules'));
const Admin = lazy(() => import('../pages/Admin'));
const Profile = lazy(() => import('../pages/Profile'));
const NotFound = lazy(() => import('../pages/NotFound'));

function Fallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="h-6 w-6 text-accent" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenges/:id" element={<ChallengeDetail />} />
              <Route path="/scoreboard" element={<ScoreboardPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/teams/:id" element={<Profile kind="team" />} />
              <Route path="/players/:id" element={<Profile kind="player" />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
