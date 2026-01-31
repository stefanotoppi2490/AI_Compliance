import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import UploadDocument from "./UploadDocument";
import DocumentsList from "./DocumentsList";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true, name: true, createdAt: true },
  });

  if (!project) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Progetto creato:{" "}
            {new Date(project.createdAt).toLocaleString("it-IT")}
          </p>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <section className="mt-8 space-y-4">
              <UploadDocument projectId={project.id} />
              <DocumentsList projectId={project.id} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
