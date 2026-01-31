export function extractJson(raw: string): any {
  const s = (raw ?? "").trim();

  // Rimuove code fences ```json ... ```
  const unfenced = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(unfenced);
}
