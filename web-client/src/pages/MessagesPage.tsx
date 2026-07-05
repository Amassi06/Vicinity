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
import { useNeighbours } from '../hooks/useNeighbours.js';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';
import { ChatAttachment } from '../components/ChatAttachment.js';
import { Avatar } from '../components/Avatar.js';
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

type Conversation =
  | { kind: 'public'; id: string; label: string }
  | { kind: 'dm'; id: string; label: string; peerId: string };

function dmConversationId(userIdA: string, userIdB: string): string {
  return `dm:${[userIdA, userIdB].sort().join(':')}`;
}

/** Colonne de gauche : salon public + un message privé par voisin. */
function ConversationList({
  conversations,
  activeId,
  online,
  onSelect,
}: {
  conversations: Conversation[];
  activeId: string | null;
  online: Set<string>;
  onSelect: (conversation: Conversation) => void;
}): ReactElement {
  const t = useT();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/50 backdrop-blur-md">
      <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold">
        {t('messages.title')}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {conversations.map((conversation) => {
          const isActive = activeId === conversation.id;
          const isOnline = conversation.kind === 'dm' && online.has(conversation.peerId);
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  isActive ? 'bg-accent font-medium' : 'hover:bg-accent/60',
                )}
              >
                {conversation.kind === 'public' ? (
                  <span className="brand-mark flex size-8 shrink-0 items-center justify-center rounded-full text-white">
                    <Users className="size-4" />
                  </span>
                ) : (
                  <Avatar
                    name={conversation.label}
                    seed={conversation.peerId}
                    size={32}
                    online={isOnline}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{conversation.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bulle de message ; dans le salon public, identifie l'expéditeur (avatar + nom). */
function MessageBubble({
  message,
  isMine,
  senderName,
  showSender,
  conversationId,
}: {
  message: Message;
  isMine: boolean;
  senderName: string | null;
  showSender: boolean;
  conversationId: string;
}): ReactElement {
  return (
    <div className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
      {showSender && !isMine && senderName ? (
        <span className="mb-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Avatar name={senderName} seed={message.senderId} size={18} />
          {senderName}
        </span>
      ) : null}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
          isMine
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
        {(message.attachments ?? []).map((attachment) => (
          <ChatAttachment
            key={attachment.storageKey}
            conversationId={conversationId}
            attachment={attachment}
          />
        ))}
        <span className="mt-0.5 block text-[11px] opacity-70">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

export function MessagesPage(): ReactElement {
  const { user } = useAuth();
  const { online, onMessage, joinConversation, leaveConversation } = useRealtime();
  const { refresh: refreshNotifications } = useNotifications();
  const { neighbours } = useNeighbours();
  const t = useT();
  const [params, setParams] = useSearchParams();

  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { recording, toggleRecording } = useVoiceRecorder({
    onRecorded: (audioBlob, filename) => void uploadAndSend(audioBlob, 'audio', filename),
    onMicrophoneDenied: () => setErrorMessage(t('messages.micDenied')),
    onEmptyRecording: () => setErrorMessage(t('messages.emptyRecording')),
  });

  const publicConversation: Conversation | null = useMemo(
    () =>
      user?.neighbourhoodId
        ? { kind: 'public', id: `nbh:${user.neighbourhoodId}`, label: t('messages.publicRoom') }
        : null,
    [user?.neighbourhoodId, t],
  );

  // Nom affiché par identifiant : voisins + moi-même (pour le salon public).
  const displayNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const neighbour of neighbours) names.set(neighbour.id, neighbour.displayName);
    if (user) names.set(user.sub, user.displayName);
    return names;
  }, [neighbours, user]);

  // Sélection initiale : DM ciblé par la query (?dm=), sinon salon public.
  useEffect(() => {
    const dmPeerId = params.get('dm');
    const dmPeerName = params.get('name');
    if (dmPeerId && user) {
      setActive({
        kind: 'dm',
        id: dmConversationId(user.sub, dmPeerId),
        label: dmPeerName ?? t('messages.directMessage'),
        peerId: dmPeerId,
      });
      setParams({}, { replace: true });
    } else if (!active && publicConversation) {
      setActive(publicConversation);
    }
  }, [params, user, publicConversation, active, setParams, t]);

  const loadMessages = useCallback(
    async (conversation: Conversation) => {
      try {
        const response = await apiFetch<{ items: Message[] }>(
          `/conversations/${conversation.id}/messages`,
        );
        setMessages(response.items);
        await apiFetch(`/conversations/${conversation.id}/read`, { method: 'POST' });
        void refreshNotifications();
      } catch (error) {
        setErrorMessage(apiErrorMessage(error, t));
      }
    },
    [t, refreshNotifications],
  );

  // Rejoint la room active et charge son historique.
  useEffect(() => {
    if (!active) return;
    joinConversation(active.id);
    void loadMessages(active);
    const activeId = active.id;
    return () => leaveConversation(activeId);
  }, [active, joinConversation, leaveConversation, loadMessages]);

  // Messages temps réel de la conversation active.
  useEffect(() => {
    return onMessage((payload) => {
      if (!active || payload['conversationId'] !== active.id) return;
      setMessages((previous) => {
        const incoming = payload as unknown as Message;
        if (previous.some((message) => message._id === incoming._id)) return previous;
        return [...previous, incoming];
      });
      if (payload['senderId'] !== user?.sub) {
        void apiFetch(`/conversations/${active.id}/read`, { method: 'POST' });
      }
    });
  }, [onMessage, active, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(formEvent: FormEvent): Promise<void> {
    formEvent.preventDefault();
    if (!active || !draft.trim()) return;
    setErrorMessage(null);
    try {
      await apiFetch(`/conversations/${active.id}/messages`, {
        method: 'POST',
        json: { body: draft.trim() },
      });
      setDraft('');
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  async function uploadAndSend(
    fileBlob: Blob,
    kind: 'image' | 'audio',
    filename: string,
  ): Promise<void> {
    if (!active) return;
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', fileBlob, filename);
      formData.append('kind', kind);
      const attachment = await apiUpload<Attachment>(
        `/conversations/${active.id}/attachments`,
        formData,
      );
      await apiFetch(`/conversations/${active.id}/messages`, {
        method: 'POST',
        json: { body: '', attachments: [attachment] },
      });
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, t));
    }
  }

  function onPickImage(changeEvent: ChangeEvent<HTMLInputElement>): void {
    const pickedFile = changeEvent.target.files?.[0];
    if (pickedFile) void uploadAndSend(pickedFile, 'image', pickedFile.name);
    changeEvent.target.value = '';
  }

  const conversations: Conversation[] = useMemo(() => {
    const list: Conversation[] = publicConversation ? [publicConversation] : [];
    for (const neighbour of neighbours) {
      if (!user) continue;
      list.push({
        kind: 'dm',
        id: dmConversationId(user.sub, neighbour.id),
        label: neighbour.displayName,
        peerId: neighbour.id,
      });
    }
    return list;
  }, [publicConversation, neighbours, user]);

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[420px] flex-col gap-4 md:grid md:grid-cols-[240px_1fr]">
      <div className="max-h-44 shrink-0 md:max-h-none md:min-h-0">
        <ConversationList
          conversations={conversations}
          activeId={active?.id ?? null}
          online={online}
          onSelect={setActive}
        />
      </div>

      {/* Fil de discussion */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/50 backdrop-blur-md">
        <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold">
          {active?.label ?? t('messages.selectConversation')}
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">{t('messages.selectConversation')}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('messages.empty')}</p>
          ) : (
            messages.map((message, messageIndex) => (
              <MessageBubble
                key={message._id}
                message={message}
                isMine={message.senderId === user?.sub}
                senderName={displayNames.get(message.senderId) ?? null}
                showSender={
                  active.kind === 'public' &&
                  messages[messageIndex - 1]?.senderId !== message.senderId
                }
                conversationId={active.id}
              />
            ))
          )}
        </div>

        {errorMessage ? (
          <Alert variant="destructive" className="mx-3 mb-2">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {active ? (
          <form
            className="flex items-center gap-2 border-t border-border/70 p-3"
            onSubmit={(formEvent) => void send(formEvent)}
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
              value={draft}
              onChange={(changeEvent) => setDraft(changeEvent.target.value)}
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
