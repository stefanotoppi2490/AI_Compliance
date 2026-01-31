"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

export default function BlobTestPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPick(file: File | null) {
    if (!file) return;
    setErr(null);
    setLoading(true);

    try {
      const safeName = `${crypto.randomUUID()}-${file.name}`;
      const res = await upload(safeName, file, {
        access: "public", // oppure "public" se vuoi URL pubblico
        handleUploadUrl: "/api/blob/upload",
        // opzionale: aggiunge suffix random per evitare collisioni
      });

      setUrl(res.url);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-10">
      <div className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-bold">Blob test</h1>
        <p className="mt-1 text-sm text-zinc-600">Carica un .pdf o .docx.</p>

        <input
          className="mt-4 block w-full text-sm"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          disabled={loading}
        />

        {loading && <p className="mt-3 text-sm">Uploading...</p>}
        {err && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}
        {url && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            OK: <span className="break-all font-mono text-xs">{url}</span>
          </div>
        )}
      </div>
    </main>
  );
}
