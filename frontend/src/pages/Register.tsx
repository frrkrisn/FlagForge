import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../api/client';
import { useRegister } from '../api/hooks';
import { AsciiWordmark } from '../components/Logo';
import { Button, Input } from '../components/ui';

const schema = z.object({
  username: z
    .string()
    .min(3, '3–20 characters')
    .max(20, '3–20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'letters, digits, _ and - only'),
  email: z.string().refine((v) => /.+@.+\..+/.test(v), 'Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof schema>;

function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['weak', 'weak', 'fair', 'good', 'strong', 'strong'];
  return { score: s, label: labels[s] };
}

export default function Register() {
  const registerMut = useRegister();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  const pw = watch('password') ?? '';
  const st = strength(pw);

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await registerMut.mutateAsync(data);
      navigate('/team');
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Registration failed');
    }
  });

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-center gap-6 border-r border-border bg-panel p-10 md:flex">
        <Link to="/">
          <AsciiWordmark className="w-full max-w-md" />
        </Link>
        <p className="max-w-sm text-sm text-fg-muted">
          The first account created becomes the event admin. Everyone after competes.
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" noValidate>
          <h1 className="font-mono text-xl text-fg">
            <span className="text-accent">$ </span>register
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
            <span className="text-xs text-fg-muted">email</span>
            <Input {...register('email')} type="email" autoComplete="email" aria-invalid={!!errors.email} />
            {errors.email && <span className="text-xs text-danger">{errors.email.message}</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-fg-muted">password</span>
            <Input type="password" {...register('password')} autoComplete="new-password" aria-invalid={!!errors.password} />
            {pw && (
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded bg-overlay">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(st.score / 5) * 100}%`, background: st.score >= 3 ? 'var(--success)' : 'var(--warning)' }}
                  />
                </div>
                <span className="text-xs text-fg-muted">{st.label}</span>
              </div>
            )}
            {errors.password && <span className="text-xs text-danger">{errors.password.message}</span>}
          </label>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Create account
          </Button>
          <p className="text-center text-sm text-fg-muted">
            Have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
