import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="term-window">
        <div className="term-titlebar">
          <span className="term-dot" style={{ background: 'var(--danger)' }} />
          <span className="term-dot" style={{ background: 'var(--warning)' }} />
          <span className="term-dot" style={{ background: 'var(--success)' }} />
          <span className="ml-2">~/404</span>
        </div>
        <div className="p-5 font-mono text-sm">
          <p className="text-fg-muted">
            <span className="text-accent">root@flagforge</span>:~$ cd {pathname}
          </p>
          <p className="mt-1 text-danger">bash: cd: {pathname}: No such file or directory</p>
          <p className="mt-4 text-fg-muted">The page you asked for does not exist.</p>
          <Link to="/" className="mt-4 inline-block">
            <Button size="sm">$ cd ~</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
