import { prisma } from "@/lib/db/prisma";

export async function getActiveDocument(projectId: string) {
  return prisma.document.findFirst({
    where: { projectId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}
