import { prisma } from "@/lib/db/prisma";
import { clearSessionCookie } from "@/lib/auth/authCookies";
import { getSessionIdFromCookie } from "@/lib/auth/authCookies";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

// ✅ aggiunta: scadenza sessione (30 giorni)
export function makeSessionExpiry(days = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  // session scaduta
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    // ✅ importante: pulisci cookie altrimenti continui a mandare sessionId morto
    await clearSessionCookie().catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
