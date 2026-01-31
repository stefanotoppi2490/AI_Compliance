import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // ✅ qui fai gating/validazioni
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Esempio: accetta solo pdf/docx
        const allowed = [".pdf", ".docx"];
        const lower = pathname.toLowerCase();
        if (!allowed.some((ext) => lower.endsWith(ext))) {
          throw new Error("Only .pdf or .docx allowed");
        }

        // opzionale: limita dimensioni (bytes)
        // NB: la size è presente nel payload client quando usi upload() (vedi sotto)
        // puoi anche usare clientPayload per passare projectId ecc.

        // Il token consentirà upload SOLO a questo pathname (o prefisso)
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          // max 25MB esempio
          maximumSizeInBytes: 25 * 1024 * 1024,
          // puoi anche settare addRandomSuffix lato client invece
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Qui NON mettere logica critica (è best-effort).  [oai_citation:6‡Vercel](https://vercel.com/docs/vercel-blob/client-upload?utm_source=chatgpt.com)
        // In futuro: potresti scrivere un record Document su DB,
        // ma meglio farlo subito dopo l'upload dal client con una POST dedicata.
        console.log("Upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Upload error" },
      { status: 400 },
    );
  }
}
