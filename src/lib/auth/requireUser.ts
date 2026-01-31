import { prisma } from "@/lib/db/prisma";
import { getAuthCookie } from "@/lib/auth/cookies";
import { verifyAuthJwt } from "@/lib/auth/jwt";

export async function requireUser() {
  const token = await getAuthCookie();
  if (!token) throw new Error("UNAUTHORIZED");

  const payload = await verifyAuthJwt(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");

  return user;
}
