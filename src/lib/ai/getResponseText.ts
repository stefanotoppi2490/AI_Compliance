export function getResponseText(resp: any): string | null {
  if (!resp) return null;

  // 1) a volte c'è
  const direct =
    typeof resp.output_text === "string" ? resp.output_text.trim() : "";
  if (direct) return direct;

  // 2) Responses API: cerca il "message" dell'assistant
  const output = Array.isArray(resp.output) ? resp.output : [];
  for (const item of output) {
    if (item?.type !== "message") continue;
    if (item?.role !== "assistant") continue;

    const content = Array.isArray(item.content) ? item.content : [];
    for (const c of content) {
      if (c?.type === "output_text" && typeof c.text === "string") {
        const t = c.text.trim();
        if (t) return t;
      }
      // fallback: alcuni SDK mettono "text" nested
      if (c?.type === "text" && typeof c.text === "string") {
        const t = c.text.trim();
        if (t) return t;
      }
    }
  }

  // 3) fallback estremo: cerca stringhe ovunque
  try {
    const s = JSON.stringify(resp);
    if (s.includes("output_text")) {
      // niente, era solo per debug
    }
  } catch {}

  return null;
}
