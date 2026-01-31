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

const SCOPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict",
    "confidence",
    "markdown",
    "reasons",
    "missingInfo",
    "suggestedReply",
  ],
  properties: {
    verdict: { type: "string", enum: ["IN_SCOPE", "OUT_OF_SCOPE", "UNCLEAR"] },
    confidence: { type: "number" },
    // ✅ questo è quello che mostri "sopra"
    markdown: { type: "string" },
    reasons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidence"],
        properties: {
          text: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    missingInfo: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "evidence"],
        properties: {
          text: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    suggestedReply: { type: "string" },
  },
} as const;

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
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You are a senior contract analyst. Classify a client request against the uploaded quote/contract. Be strict and avoid assumptions.",
      },
      {
        role: "user",
        content: `
  Client request:
  "${requestText}"
  
  Task:
  Decide IN_SCOPE / OUT_OF_SCOPE / UNCLEAR using ONLY the document content.
  - If not explicitly covered, prefer OUT_OF_SCOPE.
  - If boundaries are missing, use UNCLEAR and list the missing info.
  - Evidence must quote relevant text from the document.
  
  Also produce a short, clear Markdown summary for the UI (title + verdict + 2-4 bullets + suggested reply).
        `.trim(),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "scope_check",
        strict: true,
        schema: SCOPE_SCHEMA,
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
    return NextResponse.json(
      { ok: false, error: "Empty AI response" },
      { status: 500 },
    );
  }

  const parsed = JSON.parse(raw);

  const item = await prisma.scopeCheck.create({
    data: {
      projectId,
      documentId: doc.id,
      request: requestText,
      result: parsed,
    },
  });

  return NextResponse.json({ ok: true, item });
}
