import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";
import { getResponseText } from "@/lib/ai/getResponseText";

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

  const items = await prisma.scopeCheck.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, request: true, result: true },
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const requestText = body?.request?.trim();

  if (!requestText || requestText.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Request too short" },
      { status: 400 },
    );
  }

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

  const doc = await prisma.document.findFirst({
    where: { projectId, isActive: true },
    select: { id: true, status: true, vectorStoreId: true },
  });

  if (!doc) {
    return NextResponse.json(
      { ok: false, error: "No active document" },
      { status: 400 },
    );
  }

  if (doc.status !== "AI_READY" || !doc.vectorStoreId) {
    return NextResponse.json(
      { ok: false, error: `Document not AI_READY (${doc.status})` },
      { status: 400 },
    );
  }

  const resp = await openai.responses.create({
    model: "gpt-5.2", //gpt-4o-mini
    input: [
      {
        role: "system",
        content:
          "You are a senior contract analyst. You must classify a client request against the uploaded quote/contract. Be strict. Use ONLY what is in the document.",
      },
      {
        role: "user",
        content: `
Client request:
"${requestText}"

Return ONLY Markdown (no JSON).

Format (exactly):
# Scope Check
## Verdict: IN_SCOPE | OUT_OF_SCOPE | UNCLEAR
### Perché
- 2-5 bullet, con riferimenti a clausole / frasi del documento (quote brevi).
### Cosa manca (se UNCLEAR)
- bullet con domande puntuali / info mancanti (solo se serve)
### Risposta suggerita (email breve)
Testo in 3-6 righe, in italiano.

Rules:
- If not explicitly covered, prefer OUT_OF_SCOPE.
- If the document does not define boundaries clearly, use UNCLEAR and ask targeted questions.
- Do NOT invent evidence. If you can't find it, say it clearly.
        `.trim(),
      },
    ],
    tools: [
      {
        type: "file_search",
        vector_store_ids: [doc.vectorStoreId],
        max_num_results: 8,
      } as any,
    ],
  });

  const markdown = getResponseText(resp)?.trim();

  if (!markdown) {
    console.error("Empty AI response (scope-check)", {
      id: resp?.id,
      status: resp?.status,
      outputTypes: Array.isArray(resp?.output)
        ? (resp.output as any[]).map((x) => x?.type)
        : null,
      usage: resp?.usage,
    });

    return NextResponse.json(
      { ok: false, error: "Empty AI response" },
      { status: 500 },
    );
  }

  // Salviamo in Prisma come JSON minimal (coerente con UI)
  const item = await prisma.scopeCheck.create({
    data: {
      projectId,
      documentId: doc.id,
      request: requestText,
      result: { markdown },
    },
  });

  return NextResponse.json({ ok: true, item });
}
