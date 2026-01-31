import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";

const CreateBody = z.object({ name: z.string().min(2).max(80) });

export async function GET() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, projects });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 },
    );

  const project = await prisma.project.create({
    data: { ownerId: user.id, name: parsed.data.name.trim() },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ ok: true, project });
}
