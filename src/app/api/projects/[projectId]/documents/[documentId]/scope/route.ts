import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { buildScopePrompt } from "@/lib/ai/scopePrompt";
import { openai } from "@/lib/ai/openai";

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
    include: { chunks: { orderBy: { idx: "asc" } } },
  });

  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  if (!doc.chunks.length) {
    return NextResponse.json(
      { ok: false, message: "Documento non processato" },
      { status: 400 },
    );
  }

  // evita doppia analisi
  const existing = await prisma.scopeAnalysis.findUnique({
    where: { documentId: doc.id },
  });
  if (existing) {
    return NextResponse.json({ ok: true, result: existing.result });
  }

  const prompt = buildScopePrompt(doc.chunks);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a precise legal analyst." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");

    const parsed = JSON.parse(raw);

    const analysis = await prisma.scopeAnalysis.create({
      data: {
        documentId: doc.id,
        result: parsed,
      },
    });

    return NextResponse.json({ ok: true, result: analysis.result });
  } catch (e: any) {
    console.error("[scope-ai]", e);
    return NextResponse.json(
      { ok: false, message: "AI error" },
      { status: 500 },
    );
  }
}
