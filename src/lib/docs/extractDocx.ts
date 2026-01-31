import mammoth from "mammoth";

export async function extractTextFromDocxUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch DOCX (${res.status})`);
  }

  const ab = await res.arrayBuffer();

  // ✅ Mammoth in Node vuole un Buffer
  const buffer = Buffer.from(ab);

  const result = await mammoth.extractRawText({ buffer });

  return (result.value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
