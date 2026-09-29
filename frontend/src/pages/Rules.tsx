import { Panel, Prompt } from '../components/Panel';

const RULES = [
  ['One account per person', 'Register with a real handle. Sharing accounts is not allowed.'],
  ['Teams up to 4', 'Create a team and become captain, or join one with an invite code.'],
  ['Submit flags in CTF{...} form', 'A correct flag scores your whole team once; points decay as more teams solve.'],
  ['First blood', 'The first team to solve a challenge earns a bonus and a badge.'],
  ['Hints cost points', 'Unlocking a hint deducts its cost from your team score.'],
  ['No flag sharing', 'Some challenges issue a unique flag per team. Submitting another team’s flag is detected and flagged to admins.'],
  ['Be nice to the platform', 'No brute forcing, no attacking infrastructure. Rate limits apply after repeated wrong flags.'],
];

const FAQ = [
  ['Why did my points drop?', 'Challenge values decay as more teams solve them — everyone who solved it drops together. That is real-CTF behaviour.'],
  ['The scoreboard says “frozen”. Why?', 'Near the end, the public board freezes to a snapshot so the finish is a surprise. It reveals when the event ends.'],
  ['A challenge is locked.', 'It has prerequisites — solve the listed challenges first to unlock it.'],
];

export default function Rules() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Prompt cursor className="text-2xl">
        cat rules.md
      </Prompt>
      <Panel title="~/rules">
        <ol className="space-y-4">
          {RULES.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="font-mono text-accent">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="font-medium text-fg">{title}</div>
                <div className="text-sm text-fg-muted">{body}</div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="~/faq">
        <div className="space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <div className="font-medium text-fg">{q}</div>
              <div className="text-sm text-fg-muted">{a}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
