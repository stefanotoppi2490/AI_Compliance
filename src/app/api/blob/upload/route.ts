import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const json = await req.json();
  const res = await handleUpload({
    body: json,
    request: req,
    onBeforeGenerateToken: async () => {
      return {
        allowedContentTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        tokenPayload: JSON.stringify({}),
      };
    },
    onUploadCompleted: async () => {
      // qui potresti fare logging se vuoi
    },
  });

  return NextResponse.json(res);
}
