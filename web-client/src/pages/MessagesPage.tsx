import { FormEvent, useEffect, useRef, useState, type ReactElement } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, getAccessToken } from '../lib/api.js';
import { useNeighbourhoods } from '../context/NeighbourhoodContext.js';
import { NeighbourhoodSelect } from '../components/NeighbourhoodSelect.js';

type ChatMsg = {
  _id?: string;
  body?: string;
  senderId?: string;
  createdAt?: string;
};

export function MessagesPage(): ReactElement {
  const { selectedId } = useNeighbourhoods();
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (selectedId && !conversationId) {
      setConversationId(`nh-${selectedId.slice(0, 8)}-general`);
    }
  }, [selectedId, conversationId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return undefined;
    const s = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
    });
    socketRef.current = s;
    s.on('message:new', (payload: ChatMsg) => {
      setMessages((prev) => [...prev, payload]);
    });
    s.on('connect_error', (connectErr: Error) => {
      const hint =
        connectErr.message.includes('parser') ||
        connectErr.message.includes('ECONNREFUSED')
          ? ' — vérifiez que le backend tourne sur :3000 (npm run dev dans backend/)'
          : '';
      setErr(`Socket.IO : ${connectErr.message}${hint}`);
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  async function joinRoom(): Promise<void> {
    if (!conversationId || conversationId.length < 8) {
      setErr('Identifiant de conversation (8 caractères min).');
      return;
    }
    setErr(null);
    try {
      const res = await apiFetch<{ items: ChatMsg[] }>(
        `/conversations/${encodeURIComponent(conversationId)}/messages`,
      );
      setMessages(res.items);
      socketRef.current?.emit('conversation:join', { conversationId });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function send(ev: FormEvent): Promise<void> {
    ev.preventDefault();
    if (!conversationId) return;
    try {
      await apiFetch(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        json: { body },
      });
      setBody('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Messagerie</h1>
      <NeighbourhoodSelect />
      <div className="inline-form">
        <input
          value={conversationId}
          onChange={(e) => setConversationId(e.target.value)}
          placeholder="ID conversation"
        />
        <button type="button" className="secondary" onClick={() => void joinRoom()}>
          Rejoindre / charger
        </button>
      </div>
      {err ? <p className="error-msg">{err}</p> : null}
      <ul className="chat-log">
        {messages.map((m, i) => (
          <li key={m._id ?? i}>
            <span className="chat-meta">{m.senderId?.slice(0, 8)}</span> {m.body}
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={(e) => void send(e)}>
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" />
        <button type="submit" className="primary">
          Envoyer
        </button>
      </form>
    </section>
  );
}
