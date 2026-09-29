import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../api/client';
import { useLogin } from '../api/hooks';
import { AsciiWordmark } from '../components/Logo';
import { Button, Input } from '../components/ui';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await login.mutateAsync(data);
      navigate(params.get('returnTo') ?? '/challenges');
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Login failed');
    }
  });

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-center gap-6 border-r border-border bg-panel p-10 md:flex">
        <Link to="/">
          <AsciiWordmark className="text-xs" />
        </Link>
        <p className="max-w-sm text-sm text-fg-muted">
          Sign in to submit flags, climb the leaderboard, and draw first blood.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" noValidate>
          <h1 className="font-mono text-xl text-fg">
            <span className="text-accent">$ </span>login
          </h1>
          {formError && (
            <p className="rounded border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
              [FAIL] {formError}
            </p>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-fg-muted">username</span>
            <Input {...register('username')} autoComplete="username" aria-invalid={!!errors.username} />
            {errors.username && <span className="text-xs text-danger">{errors.username.message}</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-fg-muted">password</span>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                {...register('password')}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
          </label>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
          <p className="text-center text-sm text-fg-muted">
            No account?{' '}
            <Link to="/register" className="text-accent hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
