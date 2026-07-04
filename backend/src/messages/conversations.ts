import { prisma } from '../db/prisma.js';

/**
 * Conversations à identifiants déterministes (aucune table dédiée) :
 *  - salon public de quartier : `nbh:<neighbourhoodId>`
 *  - message privé 1-à-1       : `dm:<userA>:<userB>` (ids triés)
 */

export function publicRoomId(neighbourhoodId: string): string {
  return `nbh:${neighbourhoodId}`;
}

export function dmRoomId(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `dm:${a}:${b}`;
}

export type ParsedConversation =
  | { type: 'public'; neighbourhoodId: string }
  | { type: 'dm'; members: [string, string] }
  | null;

export function parseConversationId(cid: string): ParsedConversation {
  if (cid.startsWith('nbh:')) {
    const neighbourhoodId = cid.slice('nbh:'.length);
    return neighbourhoodId ? { type: 'public', neighbourhoodId } : null;
  }
  if (cid.startsWith('dm:')) {
    const rest = cid.slice('dm:'.length).split(':');
    if (rest.length === 2 && rest[0] && rest[1]) {
      return { type: 'dm', members: [rest[0], rest[1]] };
    }
  }
  return null;
}

/**
 * Vérifie qu'un utilisateur a le droit d'accéder à une conversation :
 *  - public : il appartient au quartier ciblé
 *  - dm     : il est l'un des deux membres
 */
export async function canAccessConversation(userId: string, cid: string): Promise<boolean> {
  const parsed = parseConversationId(cid);
  if (!parsed) return false;
  if (parsed.type === 'dm') {
    return parsed.members.includes(userId);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { neighbourhoodId: true },
  });
  return !!user?.neighbourhoodId && user.neighbourhoodId === parsed.neighbourhoodId;
}
