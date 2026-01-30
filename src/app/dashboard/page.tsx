import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ProjectsList from "./ProjectsList";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              Signed in
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Ciao{" "}
              <span className="font-semibold">{user.name ?? user.email}</span>.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              + Nuovo progetto
            </Link>

            <form action="/api/auth/logout" method="post">
              <button
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        <section className="mt-8">
          <ProjectsList />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold">Documenti</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Prossimo step: upload DOCX/PDF e text extraction.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold">Scope Check</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Prossimo step: checker “in/out/unclear” con citazioni.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
