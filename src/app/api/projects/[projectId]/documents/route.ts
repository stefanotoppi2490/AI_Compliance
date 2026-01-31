import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const originalName = body?.originalName;
  const mimeType = body?.mimeType;
  const blobUrl = body?.blobUrl;

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
    // ✅ zero parsing: passiamo direttamente fetch(blobUrl) al SDK
    const fileRes = await fetch(blobUrl);
    if (!fileRes.ok) {
      throw new Error(`Cannot fetch blobUrl (${fileRes.status})`);
    }

    const uploaded = await openai.files.create({
      file: fileRes, // <— supportato dal Node SDK  [oai_citation:2‡GitHub](https://github.com/openai/openai-node?utm_source=chatgpt.com)
      purpose: "user_data", // raccomandato per file input  [oai_citation:3‡OpenAI](https://platform.openai.com/docs/guides/pdf-files?utm_source=chatgpt.com)
    });

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        openaiFileId: uploaded.id,
        status: "AI_READY",
      },
    });

    return NextResponse.json({ ok: true, document: updated });
  } catch (e) {
    const msg = (e as Error)?.message || "OpenAI upload failed";

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { status: "ERROR" },
    });

    return NextResponse.json(
      { ok: false, error: `OpenAI upload failed: ${msg}`, document: updated },
      { status: 500 },
    );
  }
}
