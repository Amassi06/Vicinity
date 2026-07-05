import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { Image as ImageIcon, Mic, Send, Square, Users } from 'lucide-react';
import { apiFetch, apiUpload } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiError.js';
import { useAuth } from '../context/AuthContext.js';
import { useRealtime } from '../context/RealtimeContext.js';
import { useNotifications } from '../context/NotificationsContext.js';
import { useT } from '../i18n/I18nContext.js';
import { ChatAttachment } from '../components/ChatAttachment.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { cn } from '@/lib/utils.js';

type Attachment = { storageKey: string; contentType: string; size: number; kind: string };
type Message = {
  _id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
};
type Neighbour = { id: string; displayName: string; online: boolean };

type Conversation =
  | { kind: 'public'; id: string; label: string }
  | { kind: 'dm'; id: string; label: string; peerId: string };

function dmId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

export function MessagesPage(): ReactElement {
  const { user } = useAuth();
  const { online, onMessage, joinConversation, leaveConversation } = useRealtime();
  const { refresh: refreshNotifs } = useNotifications();
  const t = useT();
  const [params, setParams] = useSearchParams();

  const [neighbours, setNeighbours] = useState<Neighbour[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const publicConv: Conversation | null = useMemo(
    () =>
      user?.neighbourhoodId
        ? { kind: 'public', id: `nbh:${user.neighbourhoodId}`, label: t('messages.publicRoom') }
        : null,
    [user?.neighbourhoodId, t],
  );

  useEffect(() => {
    void apiFetch<{ items: Neighbour[] }>('/me/neighbours')
      .then((r) => setNeighbours(r.items))
      .catch(() => setNeighbours([]));
  }, []);

  // Sélection initiale : DM ciblé par la query (?dm=), sinon salon public.
  useEffect(() => {
    const dm = params.get('dm');
    const name = params.get('name');
    if (dm && user) {
      setActive({
        kind: 'dm',
        id: dmId(user.sub, dm),
        label: name ?? t('messages.directMessage'),
        peerId: dm,
      });
      setParams({}, { replace: true });
    } else if (!active && publicConv) {
      setActive(publicConv);
    }
  }, [params, user, publicConv, active, setParams, t]);

  const loadMessages = useCallback(
    async (conv: Conversation) => {
      try {
        const res = await apiFetch<{ items: Message[] }>(`/conversations/${conv.id}/messages`);
        setMessages(res.items);
        await apiFetch(`/conversations/${conv.id}/read`, { method: 'POST' });
        void refreshNotifs();
      } catch (e) {
        setErr(apiErrorMessage(e, t));
      }
    },
    [t, refreshNotifs],
  );

  // Rejoint la room active et charge son historique.
  useEffect(() => {
    if (!active) return;
    joinConversation(active.id);
    void loadMessages(active);
    const id = active.id;
    return () => leaveConversation(id);
  }, [active, joinConversation, leaveConversation, loadMessages]);

  // Messages temps réel de la conversation active.
  useEffect(() => {
    return onMessage((payload) => {
      if (!active || payload['conversationId'] !== active.id) return;
      setMessages((prev) => {
        const incoming = payload as unknown as Message;
        if (prev.some((m) => m._id === incoming._id)) return prev;
        return [...prev, incoming];
      });
      if (payload['senderId'] !== user?.sub) {
        void apiFetch(`/conversations/${active.id}/read`, { method: 'POST' });
      }
    });
  }, [onMessage, active, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!active || !body.trim()) return;
    setErr(null);
    try {
      await apiFetch(`/conversations/${active.id}/messages`, {
        method: 'POST',
        json: { body: body.trim() },
      });
      setBody('');
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  async function uploadAndSend(file: Blob, kind: 'image' | 'audio', filename: string): Promise<void> {
    if (!active) return;
    setErr(null);
    try {
      const form = new FormData();
      form.append('file', file, filename);
      form.append('kind', kind);
      const att = await apiUpload<Attachment>(`/conversations/${active.id}/attachments`, form);
      await apiFetch(`/conversations/${active.id}/messages`, {
        method: 'POST',
        json: { body: '', attachments: [att] },
      });
    } catch (e) {
      setErr(apiErrorMessage(e, t));
    }
  }

  function onPickImage(ev: ChangeEvent<HTMLInputElement>): void {
    const file = ev.target.files?.[0];
    if (file) void uploadAndSend(file, 'image', file.name);
    ev.target.value = '';
  }

  async function toggleRecording(): Promise<void> {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Choisit un type réellement supporté par le navigateur (Chrome/Firefox).
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        const type = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (blob.size === 0) {
          setErr(t('messages.emptyRecording'));
          return;
        }
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        void uploadAndSend(blob, 'audio', `voice.${ext}`);
      };
      recorderRef.current = rec;
      // timeslice : force un flush régulier des données audio.
      rec.start(250);
      setRecording(true);
    } catch {
      setErr(t('messages.micDenied'));
    }
  }

  const conversations: Conversation[] = useMemo(() => {
    const list: Conversation[] = publicConv ? [publicConv] : [];
    for (const n of neighbours) {
      if (!user) continue;
      list.push({ kind: 'dm', id: dmId(user.sub, n.id), label: n.displayName, peerId: n.id });
    }
    return list;
  }, [publicConv, neighbours, user]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      {/* Colonne conversations */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold">
          {t('messages.title')}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto p-1.5">
          {conversations.map((c) => {
            const isActive = active?.id === c.id;
            const isOnline = c.kind === 'dm' && online.has(c.peerId);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActive(c)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isActive ? 'bg-accent font-medium' : 'hover:bg-accent/60',
                  )}
                >
                  {c.kind === 'public' ? (
                    <Users className="size-4 shrink-0 text-primary" />
                  ) : (
                    <span
                      className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                      )}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Fil de discussion */}
      <div className="flex h-[70vh] flex-col rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
          {active?.label ?? t('messages.selectConversation')}
        </div>
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">{t('messages.selectConversation')}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('messages.empty')}</p>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user?.sub;
              return (
                <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                      mine
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-muted text-foreground',
                    )}
                  >
                    {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                    {(m.attachments ?? []).map((a) => (
                      <ChatAttachment key={a.storageKey} conversationId={active.id} attachment={a} />
                    ))}
                    <span className="mt-0.5 block text-[10px] opacity-70">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {err ? (
          <Alert variant="destructive" className="mx-3 mb-2">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        {active ? (
          <form
            className="flex items-center gap-2 border-t border-border p-3"
            onSubmit={(e) => void send(e)}
          >
            <label className="flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
              <ImageIcon className="size-5" />
              <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </label>
            <Button
              type="button"
              size="icon"
              variant={recording ? 'destructive' : 'secondary'}
              onClick={() => void toggleRecording()}
              aria-label={t('messages.voice')}
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('messages.body')}
              className="flex-1"
            />
            <Button type="submit" size="icon" aria-label={t('messages.send')}>
              <Send className="size-4" />
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
