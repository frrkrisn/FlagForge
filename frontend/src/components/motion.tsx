import { animate, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const EASE = [0.22, 1, 0.36, 1] as const; // a soft "ease-out-expo"

/** Fades + lifts the routed page in whenever the URL changes. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered entrance for lists/grids: wrap each item with its index. */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.045, 0.6) }}
    >
      {children}
    </motion.div>
  );
}

/** A number that eases from its previous value to the new one. */
export function CountUp({ value, className, duration = 1.1 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = Math.round(value).toLocaleString();
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString();
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
