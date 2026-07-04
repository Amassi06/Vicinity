import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/api.js';
import { useAuth } from './AuthContext.js';

type MessageHandler = (payload: Record<string, unknown>) => void;

type RealtimeValue = {
  online: Set<string>;
  socket: Socket | null;
  /** S'abonne aux nouveaux messages ; renvoie une fonction de désabonnement. */
  onMessage: (handler: MessageHandler) => () => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
};

const Ctx = createContext<RealtimeValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setOnline(new Set());
      setReady(false);
      return;
    }
    const s = io({
      path: '/socket.io',
      auth: { token: getAccessToken() },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;
    setReady(true);

    s.on('presence:snapshot', (p: { online: string[] }) => {
      setOnline(new Set(p.online));
    });
    s.on('presence:global', (p: { userId: string; status: 'online' | 'offline' }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        if (p.status === 'online') next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    });
    s.on('message:new', (payload: Record<string, unknown>) => {
      for (const h of handlersRef.current) h(payload);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setReady(false);
    };
  }, [user]);

  const onMessage = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:join', { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:leave', { conversationId });
  }, []);

  const value = useMemo(
    (): RealtimeValue => ({
      online,
      socket: ready ? socketRef.current : null,
      onMessage,
      joinConversation,
      leaveConversation,
    }),
    [online, ready, onMessage, joinConversation, leaveConversation],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime(): RealtimeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRealtime hors provider');
  return v;
}
