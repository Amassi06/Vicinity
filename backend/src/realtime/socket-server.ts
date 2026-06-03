import type { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { verifyAccessToken } from '../auth/jwt.js';
import type { Socket } from 'socket.io';

function setSocketUser(socket: Socket, userId: string): void {
  const data = socket.data as unknown as Record<string, unknown>;
  data['userId'] = userId;
}

function getSocketUser(socket: Socket): string {
  const data = socket.data as unknown as Record<string, unknown>;
  const uid = data['userId'];
  return typeof uid === 'string' ? uid : '';
}

let ioSingleton: IOServer | null = null;

function convRoom(conversationId: string): string {
  return `conv:${conversationId}`;
}

function parseJoinPayload(raw: unknown): { conversationId: string } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const cid = (raw as { conversationId?: unknown }).conversationId;
  return typeof cid === 'string' && cid.length >= 8 ? { conversationId: cid } : null;
}

export function attachSocketHttp(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    connectionStateRecovery: {},
  });

  io.use((socket, next) => {
    const auth = socket.handshake.auth as unknown as Record<string, unknown>;
    const tokenRaw = auth['token'];
    const bearer =
      typeof socket.handshake.headers.authorization === 'string' &&
      socket.handshake.headers.authorization.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice('Bearer '.length)
        : '';

    const token =
      typeof tokenRaw === 'string' && tokenRaw.length > 0 ? tokenRaw : bearer;

    if (token.length === 0) {
      next(new Error('unauthorized'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      setSocketUser(socket, payload.sub);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = getSocketUser(socket);
    socket.on('conversation:join', (payload: unknown, ack?: (r: unknown) => void) => {
      const parsed = parseJoinPayload(payload);
      if (!parsed || userId === '') {
        ack?.({ ok: false });
        return;
      }
      const room = convRoom(parsed.conversationId);
      void socket.join(room);
      socket
        .to(room)
        .emit('presence', { conversationId: parsed.conversationId, userId, status: 'online' });
      ack?.({ ok: true });
    });

    socket.on('conversation:leave', (payload: unknown, ack?: (r: unknown) => void) => {
      const parsed = parseJoinPayload(payload);
      if (!parsed) {
        ack?.({ ok: false });
        return;
      }
      const room = convRoom(parsed.conversationId);
      void socket.leave(room);
      socket
        .to(room)
        .emit('presence', { conversationId: parsed.conversationId, userId, status: 'offline' });
      ack?.({ ok: true });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (!room.startsWith('conv:')) continue;
        const conversationId = room.slice('conv:'.length);
        socket.to(room).emit('presence', { conversationId, userId, status: 'offline' });
      }
    });
  });

  ioSingleton = io;
  return io;
}

/** Push temps réel d’un nouveau message Mongo vers les sockets de la conversation. */
export function emitNewChatMessage(conversationId: string, payload: Record<string, unknown>): void {
  const io = ioSingleton;
  if (!io) return;
  io.to(convRoom(conversationId)).emit('message:new', payload);
}

export async function shutdownSockets(): Promise<void> {
  const io = ioSingleton;
  if (!io) return;
  ioSingleton = null;
  await io.close();
}
