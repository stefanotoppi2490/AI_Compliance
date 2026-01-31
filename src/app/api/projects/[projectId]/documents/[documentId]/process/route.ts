import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { extractTextFromDocxUrl } from "@/lib/docs/extractDocx";
import { chunkText } from "@/lib/docs/chunkText";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { projectId, documentId } = await params;
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      projectId,
      project: { userId: user.id },
    },
    select: { id: true, filename: true, blobUrl: true, contentType: true },
  });

  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  // per ora processiamo solo DOCX
  const lower = doc.filename.toLowerCase();
  const isDocx =
    lower.endsWith(".docx") ||
    doc.contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (!isDocx) {
    return NextResponse.json(
      { ok: false, message: "Per ora supportiamo solo DOCX." },
      { status: 400 },
    );
  }

  // evita doppio lavoro: se già esiste testo, ritorna ok
  const existing = await prisma.documentText.findUnique({
    where: { documentId: doc.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  try {
    const text = await extractTextFromDocxUrl(doc.blobUrl);
    const chunks = chunkText(text);

    await prisma.$transaction(async (tx) => {
      await tx.documentText.create({
        data: { documentId: doc.id, text },
      });

      if (chunks.length) {
        await tx.documentChunk.createMany({
          data: chunks.map((c) => ({
            documentId: doc.id,
            idx: c.idx,
            text: c.text,
          })),
        });
      }
    });

    return NextResponse.json({
      ok: true,
      chars: text.length,
      chunks: chunks.length,
    });
  } catch (e: any) {
    console.error("[process-docx]", e);
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Errore processing" },
      { status: 500 },
    );
  }
}
