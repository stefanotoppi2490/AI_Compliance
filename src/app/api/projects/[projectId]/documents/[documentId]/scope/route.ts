import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { buildScopePrompt } from "@/lib/ai/scopePrompt";
import { openai } from "@/lib/ai/openai";

export const runtime = "nodejs";

// ✅ GET: ritorna analysis se esiste
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

  const analysis = await prisma.scopeAnalysis.findUnique({
    where: { documentId: doc.id },
    select: { result: true, createdAt: true },
  });

  if (!analysis) {
    return NextResponse.json({ ok: true, result: null });
  }

  return NextResponse.json({
    ok: true,
    result: analysis.result,
    createdAt: analysis.createdAt,
  });
}

// ✅ POST: se esiste -> ritorna, altrimenti genera e salva
export async function POST(
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
    include: { chunks: { orderBy: { idx: "asc" } } },
  });

  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  if (!doc.chunks.length) {
    return NextResponse.json(
      { ok: false, message: "Documento non processato" },
      { status: 400 },
    );
  }

  const existing = await prisma.scopeAnalysis.findUnique({
    where: { documentId: doc.id },
    select: { result: true },
  });

  if (existing) {
    return NextResponse.json({
      ok: true,
      result: existing.result,
      already: true,
    });
  }

  const prompt = buildScopePrompt(doc.chunks);

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

    const analysis = await prisma.scopeAnalysis.create({
      data: { documentId: doc.id, result: parsed },
      select: { result: true },
    });

    return NextResponse.json({
      ok: true,
      result: analysis.result,
      already: false,
    });
  } catch (e) {
    console.error("[scope-ai]", e);
    return NextResponse.json(
      { ok: false, message: "AI error" },
      { status: 500 },
    );
  }
}
