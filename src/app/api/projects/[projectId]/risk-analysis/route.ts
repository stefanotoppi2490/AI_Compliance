import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";
import { getResponseText } from "@/lib/ai/getResponseText";

const RISK_DATA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallRisk", "issues", "missingClauses", "notes"],
  properties: {
    overallRisk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "severity",
          "title",
          "detail",
          "suggestedClause",
          "evidence",
        ],
        properties: {
          severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          title: { type: "string" },
          detail: { type: "string" },
          suggestedClause: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    missingClauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "why", "suggestedClause"],
        properties: {
          title: { type: "string" },
          why: { type: "string" },
          suggestedClause: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

// ✅ Dual output: reportMarkdown (umano) + data (strutturato)
const RISK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reportMarkdown", "data"],
  properties: {
    reportMarkdown: {
      type: "string",
      description:
        "Human-friendly report in Italian with headings and bullet points. No markdown fences.",
    },
    data: RISK_DATA_SCHEMA,
  },
} as const;

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

  const items = await prisma.riskAnalysis.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, result: true, inputMeta: true },
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(
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
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You are a senior contract analyst. Analyze the uploaded quote/contract and produce a CONTRACT RISK ANALYSIS.",
      },
      {
        role: "user",
        content: `
Return ONLY JSON that matches the schema.

Rules:
- reportMarkdown MUST be in Italian, readable by a non-technical user.
- reportMarkdown should include headings and bullet points, and must summarize the same content as data.
- Evidence must quote or reference the relevant clause text in evidence fields.
- If you cannot find evidence for an item, do not invent it; instead add it under missingClauses or notes.
        `.trim(),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "contract_risk_analysis_dual",
        strict: true,
        schema: RISK_SCHEMA,
      },
    },
    tools: [
      {
        type: "file_search",
        vector_store_ids: [doc.vectorStoreId],
        max_num_results: 8,
      } as any,
    ],
  });

  const raw = getResponseText(resp);
  if (!raw) {
    console.error("Empty AI response", {
      id: resp?.id,
      status: resp?.status,
      outputTypes: Array.isArray(resp?.output)
        ? resp.output.map((x: any) => x?.type)
        : null,
      usage: resp?.usage,
    });
    return NextResponse.json(
      { ok: false, error: "Empty AI response" },
      { status: 500 },
    );
  }

  // Con json_schema dovrebbe essere sempre JSON valido
  const parsed = JSON.parse(raw);

  // ✅ hardening minimo (non obbligatorio, ma utile se fai migrazioni)
  if (
    !parsed ||
    typeof parsed.reportMarkdown !== "string" ||
    !parsed.data ||
    typeof parsed.data !== "object"
  ) {
    return NextResponse.json(
      { ok: false, error: "AI response did not match expected shape" },
      { status: 500 },
    );
  }

  const item = await prisma.riskAnalysis.create({
    data: {
      projectId,
      documentId: doc.id,
      inputMeta: { model: "gpt-4o-mini", vectorStoreId: doc.vectorStoreId },
      result: parsed,
    },
  });

  return NextResponse.json({ ok: true, item });
}
