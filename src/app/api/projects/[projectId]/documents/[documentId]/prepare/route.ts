import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const { projectId, documentId } = await params;
  const user = await requireUser();

  const doc = await prisma.document.findFirst({
    where: { id: documentId, projectId, project: { ownerId: user.id } },
  });
  if (!doc)
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );

  try {
    const fileRes = await fetch(doc.blobUrl);
    if (!fileRes.ok)
      throw new Error(`Cannot fetch blobUrl (${fileRes.status})`);

    const uploaded = await openai.files.create({
      file: fileRes,
      purpose: "user_data",
    });

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: { openaiFileId: uploaded.id, status: "AI_READY" },
    });

    return NextResponse.json({ ok: true, document: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Prepare failed" },
      { status: 500 },
    );
  }
}
