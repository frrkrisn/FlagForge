import { useEffect, useState } from 'react';
import { fetchHealth, type HealthData } from './health';

type Status =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthData }
  | { kind: 'error'; message: string };

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((data) => setStatus({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <pre className="wordmark" aria-label="FlagForge">
        {String.raw`  ___ _           ___                    `}
        {'\n'}
        {String.raw` | __| |__ _ __ _| __|__ _ _ __ _ ___    `}
        {'\n'}
        {String.raw` | _|| / _\` / _\` | _/ _ \ '_/ _\` / -_)   `}
        {'\n'}
        {String.raw` |_| |_\__,_\__, |_|\___/_| \__, \___|   `}
        {'\n'}
        {String.raw`            |___/           |___/        `}
      </pre>
      <p className="tagline">CTF Competition Management System</p>

      <section className="health" aria-live="polite">
        {status.kind === 'loading' && <span className="muted">$ checking backend&hellip;</span>}
        {status.kind === 'ok' && (
          <span className="ok">
            [ OK ] backend up · v{status.data.version} ({status.data.status})
          </span>
        )}
        {status.kind === 'error' && (
          <span className="fail">
            [FAIL] backend unreachable: {status.message}
            <br />
            <span className="muted">start it with: ctf_server --port 8080</span>
          </span>
        )}
      </section>

      <footer className="foot muted">Phase 0 scaffold — full UI arrives in Prompt 7a.</footer>
    </main>
  );
}
