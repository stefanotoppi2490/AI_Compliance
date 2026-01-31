import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";

const CreateBody = z.object({
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  blobUrl: z.string().url(),
  kind: z.enum(["CONTRACT"]).optional(), // per ora fisso
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );
  }

  const documents = await prisma.document.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, documents });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 },
    );
  }

  // 1 solo attivo
  await prisma.document.updateMany({
    where: { projectId: project.id, isActive: true },
    data: { isActive: false },
  });

  const doc = await prisma.document.create({
    data: {
      projectId: project.id,
      kind: "CONTRACT",
      status: "AI_READY", // ✅ pronto per AI (hai già status)
      originalName: parsed.data.originalName,
      mimeType: parsed.data.mimeType,
      blobUrl: parsed.data.blobUrl,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, document: doc });
}
