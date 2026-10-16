#!/usr/bin/env node
// Spread a freshly seeded event's history over the last few days so the timeline chart,
// "recent solvers" and submission log look like a real, multi-day CTF.
//
//   1. stop ctf_server           (it keeps state in memory and would overwrite the file)
//   2. node scripts/backdate.mjs [data/runtime/state.json] [days]
//   3. start ctf_server again
//
// The submission list is the true chronological record, so it is used as the master
// timeline: submission i keeps its position, only its clock time changes. Each solve takes
// the time of its CORRECT submission, so first-blood order stays consistent.
// Idempotent in effect: running it again just re-spreads the same history.

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const file = process.argv[2] || 'data/runtime/state.json';
const days = Number(process.argv[3] || 3.5);

const state = JSON.parse(readFileSync(file, 'utf8'));
const subs = state.submissions || [];
if (subs.length === 0) {
  console.error('No submissions in state; nothing to spread. Run scripts/seed.mjs first.');
  process.exit(1);
}
copyFileSync(file, `${file}.bak`);

const now = Date.now();
const end = now - 12 * 60 * 1000; // newest event 12 minutes ago
const start = end - days * 24 * 3600 * 1000;

// Random gaps (exponential-ish, with a quieter "night" every day), normalised to the window.
const gaps = [];
let acc = 0;
for (let i = 0; i < subs.length; i++) {
  const progress = i / subs.length;
  const hour = new Date(start + progress * (end - start)).getHours();
  const night = hour < 7 ? 3.2 : 1; // fewer submissions in the small hours
  const gap = -Math.log(1 - Math.random() * 0.97) * night;
  acc += gap;
  gaps.push(acc);
}
const scale = (end - start) / acc;
const times = gaps.map((g) => Math.round(start + g * scale));

// 1) submissions
const solveTime = new Map(); // `${team}|${challenge}` -> ms of the correct submission
subs.forEach((s, i) => {
  s.timestamp = new Date(times[i]).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (s.result === 'CORRECT') solveTime.set(`${s.teamId}|${s.challengeId}`, times[i]);
});

// 2) solves follow their correct submission
for (const team of state.teams || []) {
  for (const solve of team.solves || []) {
    const t = solveTime.get(`${team.id}|${solve.challengeId}`);
    if (t) solve.timestamp = new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  // 3) hint unlocks happen shortly before that team solved the challenge (or at random)
  for (const hint of team.hintUnlocks || []) {
    const t = solveTime.get(`${team.id}|${hint.challengeId}`);
    const ms = t ? t - (3 + Math.random() * 25) * 60 * 1000 : start + Math.random() * (end - start);
    hint.timestamp = new Date(Math.max(start, ms)).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}

// 4) announcements, spread across the window (oldest first)
(state.announcements || []).forEach((a, i, arr) => {
  const t = start + ((i + 1) / (arr.length + 1)) * (end - start);
  a.timestamp = new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
});

// 5) the event itself started just before the first submission
if (state.event) {
  state.event.startAt = new Date(start - 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

writeFileSync(file, JSON.stringify(state, null, 2));
console.log(`Backdated ${subs.length} submissions over ${days} days (${new Date(start).toLocaleString()} → ${new Date(end).toLocaleString()}). Backup: ${file}.bak`);
