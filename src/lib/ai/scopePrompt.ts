export function buildScopePrompt(chunks: { idx: number; text: string }[]) {
  return `
You are a senior contract analyst.

You receive EXCERPTS (chunks) of a commercial proposal or contract.
Your task is to extract a STRUCTURED SCOPE OF WORK that can be used
as an authoritative reference for scope compliance checks.

Rules:
- Use ONLY the provided chunks.
- Do NOT invent features or assumptions.
- If something is not explicitly defined, mark it as "unclear".
- Always reference the chunk index used as evidence.
- Be factual, concise, and non-creative.
- This scope will be used as a SOURCE OF TRUTH for future checks.

Return ONLY valid JSON in this exact format:

{
  "project": {
    "name": "...",
    "technologies": ["..."]
  },
  "phases": [
    {
      "name": "...",
      "timeframe": "...",
      "modules": [
        {
          "name": "...",
          "includes": [
            { "text": "...", "chunk": 0 }
          ],
          "excludes": [
            { "text": "...", "chunk": 3 }
          ],
          "unclear": [
            { "text": "...", "chunk": 5 }
          ]
        }
      ]
    }
  ],
  "options": [
    {
      "name": "...",
      "details": { "text": "...", "chunk": 7 }
    }
  ],
  "future_phases": [
    {
      "name": "...",
      "details": { "text": "...", "chunk": 9 }
    }
  ],
  "notes": "short risks, assumptions, or contractual caveats"
}

Document chunks:
${chunks.map((c) => `\n[Chunk ${c.idx}]\n${c.text}`).join("\n")}
`;
}
