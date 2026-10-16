// Raw TCP listeners for the simulated pwn services, so players can really run `nc localhost 9101`.
// Each connection gets the banner, reads ONE line (capped), answers, and closes. Nothing is executed.

import { createServer } from 'node:net';
import { SERVICES, run } from './services.mjs';

const MAX_LINE = 4096;
const IDLE_MS = 30_000;

export function startNcServers(host, log = console.log) {
  const servers = [];
  for (const [name, svc] of Object.entries(SERVICES)) {
    const server = createServer((sock) => {
      sock.setTimeout(IDLE_MS, () => sock.destroy());
      sock.on('error', () => sock.destroy());
      sock.write(svc.banner);
      let buf = '';
      sock.on('data', (chunk) => {
        buf += chunk.toString('latin1'); // keep raw bytes intact for exploit payloads
        if (buf.length > MAX_LINE) {
          sock.end('\ninput too long\n');
          return;
        }
        const nl = buf.indexOf('\n');
        if (nl === -1) return;
        sock.end(`${run(name, buf.slice(0, nl))}\n`);
      });
    });
    server.on('error', (e) => log(`nc service ${name} could not listen on ${svc.port}: ${e.code ?? e.message}`));
    server.listen(svc.port, host, () => log(`  nc ${host === '0.0.0.0' ? '<host>' : host} ${svc.port}   ${svc.title}`));
    servers.push(server);
  }
  return servers;
}
