import { format } from 'date-fns';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../api/client';
import { usePostChat, useTeamChat } from '../api/hooks';
import { cn } from '../lib/cn';
import { Button, Input } from './ui';

/** Private chat for one team. Messages are plain text; React escapes them on render. */
export function TeamChat({ myId }: { myId: string }) {
  const { data: messages = [] } = useTeamChat();
  const post = usePostChat();
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1]?.id;

  // keep the newest message in view
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [last]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    post.mutate(t, {
      onSuccess: () => setText(''),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not send'),
    });
  };

  return (
    <div className="space-y-3">
      <div
        ref={box}
        role="log"
        aria-live="polite"
        aria-label="Team chat"
        className="h-72 space-y-2 overflow-y-auto rounded-2xl bg-bg p-4 shadow-nm-inset-sm"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-muted">
            Only your team can read this. Share leads, hints and half-finished ideas here.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === myId;
          return (
            <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <div className="mb-0.5 text-[11px] text-fg-muted">
                {mine ? 'you' : m.username} · {format(new Date(m.at), 'HH:mm')}
              </div>
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm',
                  mine ? 'bg-panel text-accent shadow-nm-raised-sm' : 'bg-panel text-fg shadow-nm-raised-sm',
                )}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="message your team"
          aria-label="Message"
          className="flex-1"
        />
        <Button type="submit" disabled={post.isPending || !text.trim()}>
          <Send size={14} /> send
        </Button>
      </form>
    </div>
  );
}
