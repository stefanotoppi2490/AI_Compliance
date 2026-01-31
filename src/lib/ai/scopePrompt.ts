export function buildScopePrompt(chunks: { idx: number; text: string }[]) {
  return `
  You are a senior contract analyst.
  
  You receive EXCERPTS (chunks) of a commercial document.
  Your task is to identify the SCOPE OF WORK.
  
  Rules:
  - Only use provided chunks.
  - If something is unclear, mark it as "unclear".
  - Always reference the chunk index used as evidence.
  - Be concise, factual, non-creative.
  
  Return ONLY valid JSON in this exact format:
  
  {
    "included": [
      { "text": "...", "chunk": 0 }
    ],
    "excluded": [
      { "text": "...", "chunk": 3 }
    ],
    "unclear": [
      { "text": "...", "chunk": 5 }
    ],
    "notes": "short overall notes or risks"
  }
  
  Here are the document chunks:
  ${chunks.map((c) => `\n[Chunk ${c.idx}]\n${c.text}`).join("\n")}
  `;
}
