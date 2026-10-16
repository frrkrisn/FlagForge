import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

// ---- Button ----
// Soft-UI: raised by default, pressed-in while held. Colors/shadows come from theme tokens
// (see .nm-btn* in globals.css), so every preset restyles it automatically.
const button = cva(
  'nm-btn inline-flex items-center justify-center gap-2 font-mono text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
  {
    variants: {
      variant: {
        primary: 'nm-btn-primary',
        outline: '',
        ghost: 'nm-btn-ghost',
        danger: 'nm-btn-danger',
      },
      size: { sm: 'h-8 px-3.5', md: 'h-10 px-5', icon: 'h-10 w-10 !rounded-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ---- Input (recessed into the surface) ----
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-[14px] border border-transparent bg-bg px-4 font-mono text-sm text-fg shadow-nm-inset-sm placeholder:text-fg-muted focus-visible:border-accent focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

// ---- Spinner ----
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
    </svg>
  );
}

// ---- Badge (a small pressed-in chip) ----
export function Badge({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium shadow-nm-inset-sm',
        className,
      )}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}

// ---- Skeleton ----
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-panel shadow-nm-inset-sm', className)} />;
}

// ---- EmptyState (a shallow well) ----
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-bg px-6 py-12 text-center shadow-nm-inset">
      {icon && <div className="text-fg-muted">{icon}</div>}
      <div className="font-mono text-sm text-fg">{title}</div>
      {hint && <div className="max-w-md text-xs text-fg-muted">{hint}</div>}
      {action}
    </div>
  );
}
