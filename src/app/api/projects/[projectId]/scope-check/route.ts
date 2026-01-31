import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveDocument } from "@/lib/projects/getActiveDocument";

const Body = z.object({
  request: z.string().min(6),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project)
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );

  const doc = await getActiveDocument(project.id);
  if (!doc)
    return NextResponse.json(
      { ok: false, error: "No active document" },
      { status: 400 },
    );

  if (doc.status !== "AI_READY") {
    return NextResponse.json(
      { ok: false, error: `Document not AI_READY (${doc.status})` },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: "Invalid body" },
      { status: 400 },
    );

  // ✅ STUB (poi OpenAI)
  const lower = parsed.data.request.toLowerCase();
  const verdict =
    lower.includes("login") && lower.includes("social")
      ? "UNCLEAR"
      : lower.includes("hosting") || lower.includes("manutenzione")
        ? "OUT_OF_SCOPE"
        : "UNCLEAR";

  const result = {
    verdict,
    confidence: 0.55,
    reasons: [
      { text: "Risultato stub: non AI.", chunk: 0 },
      { text: `Documento attivo: ${doc.originalName}`, chunk: 0 },
    ],
    missingInfo:
      verdict === "UNCLEAR"
        ? [
            {
              text: "Il preventivo non specifica modalità di login/registrazione.",
              chunk: 0,
            },
          ]
        : [],
    suggestedReply:
      verdict === "OUT_OF_SCOPE"
        ? "La richiesta non risulta inclusa nel preventivo attuale. Possiamo stimarla come extra (change request)."
        : "Per confermare se è incluso, serve chiarire: sono previsti login/registrazione? con quali metodi (email/password, SSO)?",
  };

  const saved = await prisma.scopeCheck.create({
    data: {
      projectId: project.id,
      documentId: doc.id,
      request: parsed.data.request,
      result,
    },
  });

  return NextResponse.json({ ok: true, item: saved });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project)
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );

  const items = await prisma.scopeCheck.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ok: true, items });
}
