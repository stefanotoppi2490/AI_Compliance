import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { projectId } = await params;
  const docs = await prisma.document.findMany({
    where: {
      projectId: projectId,
      project: { userId: user.id },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      createdAt: true,
      text: { select: { id: true } }, // 👈 basta sapere se esiste
    },
  });

  return NextResponse.json({
    ok: true,
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      createdAt: d.createdAt,
      processed: !!d.text,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { projectId } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.blobUrl || !body?.filename) {
    return NextResponse.json(
      { ok: false, message: "Dati mancanti" },
      { status: 400 },
    );
  }

  // ownership check
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const doc = await prisma.document.create({
    data: {
      projectId: project.id,
      filename: body.filename,
      blobUrl: body.blobUrl,
      contentType: body.contentType ?? "application/octet-stream",
      size: body.size ?? 0,
    },
  });

  return NextResponse.json({ ok: true, document: doc });
}
