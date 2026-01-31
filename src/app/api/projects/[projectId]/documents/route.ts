import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const user = await requireUser();

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
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      blobUrl: true,
      isActive: true,
      createdAt: true,
      status: true,
      openaiFileId: true,
    },
  });

  return NextResponse.json({ ok: true, documents });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const originalName =
    typeof body?.originalName === "string" ? body.originalName : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : "";

  if (!originalName || !mimeType || !blobUrl) {
    return NextResponse.json(
      { ok: false, error: "Missing originalName/mimeType/blobUrl" },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported file type" },
      { status: 400 },
    );
  }

  // verifica ownership progetto
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

  // 1) Crea Document e disattiva altri (1 attivo)
  const doc = await prisma.$transaction(async (tx) => {
    await tx.document.updateMany({
      where: { projectId, isActive: true },
      data: { isActive: false },
    });

    return tx.document.create({
      data: {
        projectId,
        originalName,
        mimeType,
        blobUrl,
        isActive: true,
        status: "UPLOADED",
      },
    });
  });

  // 2) Upload su OpenAI + set AI_READY
  try {
    const fileRes = await fetch(blobUrl);
    if (!fileRes.ok) {
      throw new Error(`Cannot fetch blobUrl (${fileRes.status})`);
    }

    const uploaded = await openai.files.create({
      file: fileRes,
      purpose: "user_data",
    });

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        openaiFileId: uploaded.id,
        status: "AI_READY",
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        blobUrl: true,
        isActive: true,
        createdAt: true,
        status: true,
        openaiFileId: true,
      },
    });

    return NextResponse.json({ ok: true, document: updated });
  } catch (e) {
    const msg = (e as Error)?.message || "OpenAI upload failed";

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { status: "ERROR" },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        blobUrl: true,
        isActive: true,
        createdAt: true,
        status: true,
        openaiFileId: true,
      },
    });

    return NextResponse.json(
      { ok: false, error: `OpenAI upload failed: ${msg}`, document: updated },
      { status: 500 },
    );
  }
}
