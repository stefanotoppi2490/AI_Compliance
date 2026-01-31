"use client";

import { upload } from "@vercel/blob/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { useState } from "react";

export default function UploadDocument({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const safeName = `${crypto.randomUUID()}-${file.name}`;
      const blob = await upload(safeName, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });

      return clientFetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          blobUrl: blob.url,
          contentType: file.type,
          size: file.size,
        }),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["csg", "documents", projectId] });
    },
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <label className="block text-sm font-semibold mb-2">
        Carica documento (PDF / DOCX)
      </label>

      <input
        type="file"
        accept=".pdf,.docx"
        disabled={mutation.isPending}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) mutation.mutate(f);
        }}
        className="block w-full text-sm"
      />

      {mutation.isPending && (
        <p className="mt-2 text-sm text-zinc-600">Upload in corso…</p>
      )}

      {err && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
    </div>
  );
}
