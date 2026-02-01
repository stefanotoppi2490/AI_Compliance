import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/requireUser";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: user.id },
    select: { id: true },
  });

  if (!project)
    return NextResponse.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );

  await prisma.project.delete({
    where: { id: project.id },
  });

  return NextResponse.json({ ok: true });
}
