import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { openai } from "@/lib/ai/openai";
import { buildRequestCheckPrompt } from "@/lib/ai/requestCheckPrompt";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; documentId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  const requestText = (body?.request ?? "").toString().trim();
  if (!requestText) {
    return NextResponse.json(
      { ok: false, message: "Richiesta mancante." },
      { status: 400 },
    );
  }

  // doc + chunks
  const doc = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      projectId: params.projectId,
      project: { userId: user.id },
    },
    include: { chunks: { orderBy: { idx: "asc" } } },
  });

  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });
  if (!doc.chunks.length) {
    return NextResponse.json(
      { ok: false, message: "Documento non processato." },
      { status: 400 },
    );
  }

  // scope obbligatorio (se no check non ha senso)
  const scope = await prisma.scopeAnalysis.findUnique({
    where: { documentId: doc.id },
    select: { result: true },
  });
  if (!scope) {
    return NextResponse.json(
      { ok: false, message: "Genera prima lo Scope Bullets." },
      { status: 400 },
    );
  }

  const prompt = buildRequestCheckPrompt({
    scope: scope.result,
    chunks: doc.chunks.map((c) => ({ idx: c.idx, text: c.text })),
    request: requestText,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a precise contract analyst." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");

    const parsed = JSON.parse(raw);

    const saved = await prisma.requestCheck.create({
      data: {
        documentId: doc.id,
        input: requestText,
        result: parsed,
      },
      select: { id: true, createdAt: true, input: true, result: true },
    });

    return NextResponse.json({ ok: true, item: saved });
  } catch (e) {
    console.error("[request-check]", e);
    return NextResponse.json(
      { ok: false, message: "AI error" },
      { status: 500 },
    );
  }
}

// history (ultimi 20)
export async function GET(
  _req: Request,
  { params }: { params: { projectId: string; documentId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const doc = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      projectId: params.projectId,
      project: { userId: user.id },
    },
    select: { id: true },
  });

  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  const items = await prisma.requestCheck.findMany({
    where: { documentId: doc.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, input: true, result: true },
  });

  return NextResponse.json({ ok: true, items });
}
