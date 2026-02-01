import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";
import { openai } from "@/lib/openai/client";
import { getResponseText } from "@/lib/ai/getResponseText";
import { put } from "@vercel/blob";
import { markdownToDocxBuffer } from "@/lib/docx/markdownToDocx";

function safeSlug(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function extractMarkdownFromResult(result: unknown): string | null {
  // nuovo formato: { markdown: "..." }
  if (result && typeof (result as any).markdown === "string") {
    const md = String((result as any).markdown).trim();
    return md.length ? md : null;
  }

  // fallback legacy: { reportMarkdown: "..." }
  if (result && typeof (result as any).reportMarkdown === "string") {
    const md = String((result as any).reportMarkdown).trim();
    return md.length ? md : null;
  }

  // fallback estremo: se hai salvato direttamente una stringa
  if (typeof result === "string") {
    const md = result.trim();
    return md.length ? md : null;
  }

  return null;
}

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

  const items = await prisma.generatedProposal.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      documentId: true,
      filename: true,
      blobUrl: true,
      mimeType: true,
      inputMeta: true,
      // ✅ niente markdown in risposta (UI: solo download)
    },
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
    select: { id: true, status: true, vectorStoreId: true, originalName: true },
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

  // ---- Pull latest risk analysis for THIS document (Option A)
  const latestRisk = await prisma.riskAnalysis.findFirst({
    where: { projectId, documentId: doc.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, result: true, inputMeta: true },
  });

  const riskMarkdown = latestRisk
    ? extractMarkdownFromResult(latestRisk.result)
    : null;

  // ---- AI generation (Markdown interno, non esposto)
  const resp = await openai.responses.create({
    model: "gpt-5.2",
    input: [
      {
        role: "system",
        content:
          "You are a senior proposal writer and contract analyst. Improve the uploaded quote by preserving what exists, adding missing essentials, and refining what is unclear — without inventing scope.",
      },
      {
        role: "user",
        content: `
Scrivi SOLO in Markdown (niente JSON, niente code fences).

Hai anche una Contract Risk Analysis precedente (usa come CHECKLIST, non come fonte di verità):
${
  riskMarkdown
    ? `\n---\n# Risk Analysis (checklist)\n${riskMarkdown}\n---\n`
    : "\n[Nessuna risk analysis disponibile: procedi solo dal documento.]\n"
}

Obiettivo:
- Mantieni e riusa quanto già presente nel documento (ambito, voci, prezzi, tempi, tecnologie, termini).
- Ottimizza ciò che esiste: rendilo più chiaro, coerente, leggibile e “pronto da inviare”.
- Aggiungi SOLO ciò che manca per renderlo un preventivo “contrattualizzabile” (termini minimi), in modo bilanciato e non aggressivo.
- NON aggiungere nuove attività / nuove feature / nuovo scope.
- NON inventare dettagli: se mancano info indispensabili, usa placeholder [DA DEFINIRE] e metti domande in "Dati mancanti".

Regole di fedeltà:
- La fonte di verità è il documento caricato. La risk analysis è una checklist.
- Se un punto dipende dal documento, cita tra virgolette un estratto rilevante.
- Se non trovi il riferimento nel documento, scrivi "Non trovato nel documento" e usa [DA DEFINIRE] oppure sposta in "Dati mancanti".
- Assicurati che i punti ad ALTA/MEDIA severità della risk analysis siano coperti (clausola/placeholder/domanda), SENZA inventare fatti.

Struttura:
# Preventivo ottimizzato (contratto-ready)
## 1. Contesto e oggetto
- 2-4 bullet di sintesi chiara (cosa, per chi, outcome)

## 2. Ambito e Deliverable (Allegato A)
- elenco puntato verificabile
- conserva e riorganizza le voci originali (senza cambiare l’offerta)

## 3. Esclusioni esplicite
- rendi esplicite le esclusioni già presenti o implicite (senza inventare)

## 4. Prezzo e condizioni economiche
- prezzi / range / IVA / eventuali ricorrenze
- se c’è un range: NON scegliere tu un numero. Mantieni range + come fissarlo ([DA DEFINIRE])

## 5. Tempi, milestone, consegne e accettazione
- solo se presenti o chiaramente desumibili
- altrimenti [DA DEFINIRE] + domanda in fondo

## 6. Change request (variazioni)
- processo semplice: richiesta scritta, impatto su tempi/costi, approvazione

## 7. Hosting / costi ricorrenti (se presenti)
- cosa include, durata, chi paga dopo, [DA DEFINIRE] dove serve

## 8. Proprietà intellettuale e consegna materiali/codice
- clausola bilanciata, senza forzare (placeholder se serve)

## 9. Responsabilità e limitazioni
- testo prudente e ragionevole, non aggressivo

## 10. Riservatezza e privacy
- solo se pertinente (dati personali / accessi / documenti)

## 11. Recesso / risoluzione
- minimo sindacale + effetti (consegna quanto prodotto, pagamenti, ecc.)

## 12. Legge e foro
- [DA DEFINIRE] se non specificato

## 13. Dati mancanti / domande (max 8)
- domande secche e mirate per chiudere i buchi

Stile:
- Italiano professionale, leggibile da non tecnici.
- Titoli chiari, elenchi puntati, frasi corte.
        `.trim(),
      },
    ],
    tools: [
      {
        type: "file_search",
        vector_store_ids: [doc.vectorStoreId],
        max_num_results: 6,
      } as any,
    ],
  });

  const md = (getResponseText(resp) ?? "").trim();
  if (!md) {
    console.error("Empty AI response (generated-proposal)", {
      id: (resp as any)?.id,
      status: (resp as any)?.status,
      usage: (resp as any)?.usage,
      outputTypes: Array.isArray((resp as any)?.output)
        ? (resp as any).output.map((x: any) => x?.type)
        : null,
    });

    return NextResponse.json(
      { ok: false, error: "Empty AI response" },
      { status: 500 },
    );
  }

  // ---- Markdown -> DOCX
  const docxBuffer = await markdownToDocxBuffer(md);

  // ---- Save to blob (download DOCX)
  const baseName = safeSlug(doc.originalName || "preventivo");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `preventivo-ottimizzato_${baseName}_${ts}.docx`;
  const blobPath = `projects/${projectId}/generated/${filename}`;

  const blob = await put(blobPath, docxBuffer, {
    access: "public",
    contentType: DOCX_MIME,
    addRandomSuffix: false,
  });

  // ---- Save to DB (UI: link al docx)
  const item = await prisma.generatedProposal.create({
    data: {
      projectId,
      documentId: doc.id,
      filename,
      blobUrl: blob.url,
      mimeType: DOCX_MIME,

      // ✅ audit/debug (UI non lo mostra)
      markdown: md,

      inputMeta: {
        model: "gpt-5.2",
        vectorStoreId: doc.vectorStoreId,
        responseId: (resp as any)?.id ?? null,

        // ✅ collegamento al risk usato come checklist
        riskAnalysisUsed: latestRisk
          ? {
              id: latestRisk.id,
              createdAt: latestRisk.createdAt,
              model: (latestRisk.inputMeta as any)?.model ?? null,
            }
          : null,
      },
    },
    select: {
      id: true,
      createdAt: true,
      documentId: true,
      filename: true,
      blobUrl: true,
      mimeType: true,
      inputMeta: true,
    },
  });

  return NextResponse.json({ ok: true, item });
}
