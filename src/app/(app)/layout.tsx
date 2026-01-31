import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-zinc-200 bg-white lg:block">
          <div className="p-5">
            <div className="text-lg font-extrabold tracking-tight text-zinc-900">
              AI Compliance
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Contracts & preventivi
            </div>
          </div>

          <nav className="px-3 pb-5">
            <a
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              <span className="h-2 w-2 rounded-full bg-zinc-900" />
              Dashboard
            </a>
          </nav>

          <div className="mt-auto px-3 pb-5">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Logout
              </button>
            </form>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          {/* Topbar */}
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">
                Dashboard
              </div>
              <div className="text-xs text-zinc-500">Velvet-inspired</div>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
