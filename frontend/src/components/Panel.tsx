import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** A terminal-window styled card: title bar with three dots + a path title. */
export function Panel({
  title,
  children,
  className,
  actions,
  bodyClassName,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('term-window', className)}>
      {title !== undefined && (
        <header className="term-titlebar">
          <span className="term-dot" style={{ background: 'var(--danger)' }} />
          <span className="term-dot" style={{ background: 'var(--warning)' }} />
          <span className="term-dot" style={{ background: 'var(--success)' }} />
          <span className="ml-2 truncate">{title}</span>
          {actions && <span className="ml-auto flex items-center gap-2">{actions}</span>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** A prompt-style heading: `$ ls challenges` with an optional blinking cursor. */
export function Prompt({
  children,
  cursor,
  className,
}: {
  children: ReactNode;
  cursor?: boolean;
  className?: string;
}) {
  return (
    <h2 className={cn('font-mono text-fg', className)}>
      <span className="text-accent">$ </span>
      <span className={cursor ? 'cursor' : undefined}>{children}</span>
    </h2>
  );
}
