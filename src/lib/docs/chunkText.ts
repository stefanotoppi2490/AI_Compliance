export type Chunk = { idx: number; text: string };

export function chunkText(
  text: string,
  opts?: { chunkSize?: number; overlap?: number },
): Chunk[] {
  const chunkSize = opts?.chunkSize ?? 1200;
  const overlap = opts?.overlap ?? 200;

  const clean = text.trim();
  if (!clean) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push({ idx, text: piece });

    idx += 1;
    if (end === clean.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}
