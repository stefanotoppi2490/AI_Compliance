type Chunk = { idx: number; text: string };

export function buildRequestCheckPrompt(args: {
  scope: any; // structured scope JSON saved previously
  chunks: Chunk[];
  request: string;
}) {
  const { scope, chunks, request } = args;

  return `
You are a senior contract analyst.

You have:
1) A STRUCTURED SCOPE JSON extracted previously (this is the authoritative source of truth)
2) The original document CHUNKS with indices (these are supporting evidence)
3) A CLIENT REQUEST to evaluate

Definitions:
- IN_SCOPE: The request is explicitly included in the SCOPE, or can be reasonably inferred from an included module
  WITHOUT expanding functionality beyond what the SCOPE implies.
- OUT_OF_SCOPE: The request adds new functionality not covered by the SCOPE (even if related).
- UNCLEAR: The request cannot be evaluated because key details are missing OR the SCOPE does not define boundaries
  sufficient to decide.

Rules (IMPORTANT):
- The SCOPE JSON is authoritative. Use CHUNKS only to cite evidence and clarify wording.
- Do NOT invent scope items. Do NOT assume features unless supported by SCOPE.
- If a request depends on unspecified implementation choices (provider, platform, data sources, integrations, SLA),
  mark UNCLEAR and list the missing info.
- Always provide chunk indices for each reason or missing info item.
- Be concise, factual, and non-creative.

Task:
- Decide whether the CLIENT REQUEST is IN_SCOPE, OUT_OF_SCOPE, or UNCLEAR.
- Provide short bullet-style reasons with evidence (chunk indices).
- If UNCLEAR, list missing information required to decide.
- Provide a short professional suggested reply to the client that matches the verdict.

Return ONLY valid JSON in this exact format:

{
  "verdict": "IN_SCOPE" | "OUT_OF_SCOPE" | "UNCLEAR",
  "confidence": 0.0,
  "reasons": [
    { "text": "...", "chunk": 0 }
  ],
  "missingInfo": [
    { "text": "...", "chunk": 3 }
  ],
  "assumptions": [
    { "text": "...", "chunk": 0 }
  ],
  "suggestedReply": "short email reply"
}

Guidance for fields:
- confidence: number from 0.0 to 1.0
- reasons: 2–6 items max, each must reference a chunk index
- missingInfo: only populate when verdict is UNCLEAR (otherwise return [])
- assumptions: only include assumptions that are explicitly grounded in SCOPE or CHUNKS; otherwise return []
- suggestedReply:
  - IN_SCOPE: confirm it's included and (optionally) ask for any needed details
  - OUT_OF_SCOPE: state it's outside scope and offer a brief next step (change request / estimate)
  - UNCLEAR: ask targeted questions needed to classify

SCOPE JSON (authoritative):
${JSON.stringify(scope)}

CLIENT REQUEST:
${request}

DOCUMENT CHUNKS (supporting evidence):
${chunks.map((c) => `\n[Chunk ${c.idx}]\n${c.text}`).join("\n")}
`;
}
