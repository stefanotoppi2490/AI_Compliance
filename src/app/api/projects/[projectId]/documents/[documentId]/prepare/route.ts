import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
    },
  });

  return NextResponse.json({ ok: true, documents });
}

async function pollVectorStoreFile(vectorStoreId: string, fileId: string) {
  for (let i = 0; i < 60; i++) {
    const vsFile = await openai.vectorStores.files.retrieve(fileId, {
      vector_store_id: vectorStoreId,
    });

    const status = (vsFile as any).status; // "in_progress" | "completed" | "failed"
    if (status === "completed") return { ok: true as const };
    if (status === "failed")
      return { ok: false as const, error: "Vector store indexing failed" };

    await sleep(2000);
  }
  return { ok: false as const, error: "Vector store indexing timeout" };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const { projectId, documentId } = await params;
  const user = await requireUser();

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      projectId,
      project: { ownerId: user.id },
    },
  });

  if (!doc) {
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );
  }

  if (!doc.blobUrl) {
    return NextResponse.json(
      { ok: false, error: "Missing blobUrl" },
      { status: 400 },
    );
  }

  try {
    // 1) Upload file su OpenAI (se non già fatto)
    let openaiFileId = doc.openaiFileId ?? null;

    if (!openaiFileId) {
      const fileRes = await fetch(doc.blobUrl);
      if (!fileRes.ok)
        throw new Error(`Cannot fetch blobUrl (${fileRes.status})`);

      const uploaded = await openai.files.create({
        file: fileRes,
        purpose: "user_data", // raccomandato per file usati come input  [oai_citation:5‡OpenAI](https://platform.openai.com/docs/api-reference/files?utm_source=chatgpt.com)
      });

      openaiFileId = uploaded.id;

      await prisma.document.update({
        where: { id: doc.id },
        data: { openaiFileId },
      });
    }

    // 2) Crea vector store (se non già fatto)
    let vectorStoreId = doc.vectorStoreId ?? null;
    if (!vectorStoreId) {
      const vs = await openai.vectorStores.create({
        name: `project:${projectId} doc:${doc.id}`,
      }); // Vector stores API  [oai_citation:6‡OpenAI](https://platform.openai.com/docs/api-reference/vector-stores?utm_source=chatgpt.com)
      vectorStoreId = vs.id;

      await prisma.document.update({
        where: { id: doc.id },
        data: { vectorStoreId },
      });
    }

    // 3) Attacca il file al vector store (se non già fatto)
    let vectorStoreFileId = doc.vectorStoreFileId ?? null;
    if (!vectorStoreFileId) {
      const vsFile = await openai.vectorStores.files.create(vectorStoreId, {
        file_id: openaiFileId,
      }); // attach file  [oai_citation:7‡OpenAI](https://platform.openai.com/docs/api-reference/vector-stores-files?utm_source=chatgpt.com)

      vectorStoreFileId = vsFile.id;

      await prisma.document.update({
        where: { id: doc.id },
        data: { vectorStoreFileId },
      });
    }

    // 4) Poll finché indexing completed
    const polled = await pollVectorStoreFile(vectorStoreId, vectorStoreFileId);
    if (!polled.ok) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "ERROR" },
      });
      return NextResponse.json(
        { ok: false, error: polled.error },
        { status: 500 },
      );
    }

    // 5) Mark AI_READY
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { status: "AI_READY" },
    });

    return NextResponse.json({ ok: true, document: updated });
  } catch (e) {
    const msg = (e as Error)?.message ?? "Prepare failed";
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "ERROR" },
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
