import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { getActiveDocument } from "@/lib/projects/getActiveDocument";

export async function POST(
  _req: Request,
  { params }: { params: { projectId: string } },
) {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, ownerId: user.id },
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

  // ✅ STUB (poi OpenAI)
  const result = {
    summary: "Analisi rischio (stub)",
    risks: [
      {
        severity: "HIGH",
        title: "Ambiguità su extra e costi ricorrenti",
        note: "Verificare costi server / SLA / rinnovi.",
      },
      {
        severity: "MEDIUM",
        title: "Confini scope non espliciti",
        note: "Specificare inclusioni/esclusioni e change request.",
      },
    ],
    suggestions: [
      "Aggiungere clausola revisioni incluse + change request.",
      "Definire milestone, pagamenti e dipendenze cliente.",
    ],
    usedDocument: { id: doc.id, name: doc.originalName, blobUrl: doc.blobUrl },
  };

  const saved = await prisma.riskAnalysis.create({
    data: {
      projectId: project.id,
      documentId: doc.id,
      inputMeta: { version: "v1", mode: "stub" },
      result,
    },
  });

  return NextResponse.json({ ok: true, item: saved });
}

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } },
) {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, ownerId: user.id },
    select: { id: true },
  });
  if (!project)
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );

  const items = await prisma.riskAnalysis.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ok: true, items });
}
