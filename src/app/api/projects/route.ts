import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, projects });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim();

  if (!name || name.length < 2) {
    return NextResponse.json(
      { ok: false, message: "Nome progetto non valido." },
      { status: 400 },
    );
  }

  try {
    const project = await prisma.project.create({
      data: { userId: user.id, name },
      select: { id: true, name: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, project }, { status: 200 });
  } catch (e: any) {
    // unique userId+name
    return NextResponse.json(
      { ok: false, message: "Hai già un progetto con questo nome." },
      { status: 409 },
    );
  }
}
