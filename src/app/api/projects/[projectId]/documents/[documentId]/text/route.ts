import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { projectId, documentId } = await params;
  const text = await prisma.documentText.findFirst({
    where: {
      documentId,
      document: {
        projectId,
        project: { userId: user.id },
      },
    },
    select: { text: true },
  });

  if (!text) {
    return NextResponse.json(
      { ok: false, message: "Not processed" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, text: text.text });
}
