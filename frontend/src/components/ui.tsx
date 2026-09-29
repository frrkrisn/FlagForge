import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

// ---- Button ----
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded font-mono text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:brightness-110 glow-box',
        outline: 'border border-border-strong text-fg hover:bg-overlay',
        ghost: 'text-fg-muted hover:text-fg hover:bg-overlay',
        danger: 'bg-danger text-[#180404] hover:brightness-110',
      },
      size: { sm: 'h-8 px-3', md: 'h-10 px-4', icon: 'h-9 w-9' },
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

// ---- Input ----
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded border border-border bg-overlay px-3 font-mono text-sm text-fg placeholder:text-fg-muted focus-visible:border-accent focus-visible:outline-none',
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

// ---- Badge ----
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
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={color ? { color, borderColor: color } : undefined}
    >
      {children}
    </span>
  );
}

// ---- Skeleton ----
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-overlay', className)} />;
}

// ---- EmptyState ----
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-fg-muted">{icon}</div>}
      <div className="font-mono text-sm text-fg">{title}</div>
      {hint && <div className="max-w-md text-xs text-fg-muted">{hint}</div>}
      {action}
    </div>
  );
}
