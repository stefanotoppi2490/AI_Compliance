// /lib/docx/markdownToDocx.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
} from "docx";

function parseInlineBold(text: string): TextRun[] {
  // supporta **bold** semplice
  const runs: TextRun[] = [];
  const parts = text.split("**");
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i];
    if (!t) continue;
    runs.push(
      new TextRun({
        text: t,
        bold: i % 2 === 1,
      }),
    );
  }
  return runs.length ? runs : [new TextRun(text)];
}

export async function markdownToDocxBuffer(md: string): Promise<Buffer> {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");

  const children: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    // linea vuota
    if (!line.trim()) {
      children.push(new Paragraph({ text: "" }));
      continue;
    }

    // HR ---
    if (/^---+$/.test(line.trim())) {
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "D4D4D8" },
          },
        }),
      );
      continue;
    }

    // headings
    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInlineBold(line.slice(2).trim()),
        }),
      );
      continue;
    }
    if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineBold(line.slice(3).trim()),
        }),
      );
      continue;
    }
    if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineBold(line.slice(4).trim()),
        }),
      );
      continue;
    }

    // bullet "- "
    if (line.startsWith("- ")) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineBold(line.slice(2).trim()),
        }),
      );
      continue;
    }

    // fallback paragrafo
    children.push(new Paragraph({ children: parseInlineBold(line.trim()) }));
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const uint8 = await Packer.toBuffer(doc);
  return Buffer.from(uint8);
}
