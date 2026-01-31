"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { upload } from "@vercel/blob/client";

type Doc = {
  id: string;
  originalName: string;
  mimeType: string;
  blobUrl: string;
  isActive: boolean;
  createdAt: string;
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const qc = useQueryClient();

  const [fileErr, setFileErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const docsQuery = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; documents: Doc[] }>(
        `/api/projects/${projectId}/documents`,
      ),
  });

  const docs = docsQuery.data?.documents ?? [];
  const activeDoc = useMemo(() => docs.find((d) => d.isActive) ?? null, [docs]);

  const createDocMutation = useMutation({
    mutationFn: async (payload: {
      originalName: string;
      mimeType: string;
      blobUrl: string;
    }) =>
      clientFetch<{ ok: true; document: Doc }>(
        `/api/projects/${projectId}/documents`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["project-documents", projectId],
      });
    },
  });

  async function onPickFile(file: File | null) {
    if (!file) return;

    setFileErr(null);

    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setFileErr("Formato non supportato. Carica PDF o DOCX.");
      return;
    }

    // max 20MB (MVP)
    if (file.size > 20 * 1024 * 1024) {
      setFileErr("File troppo grande (max 20MB).");
      return;
    }

    setUploading(true);
    try {
      // Upload diretto a Vercel Blob
      const blob = await upload(
        `projects/${projectId}/${Date.now()}_${file.name}`.replaceAll(" ", "_"),
        file,
        {
          access: "public",
          handleUploadUrl: "/api/blob/upload", // endpoint standard vercel blob
        },
      );

      // Salva su DB (disattiva altri, 1 attivo)
      await createDocMutation.mutateAsync({
        originalName: file.name,
        mimeType: file.type,
        blobUrl: blob.url,
      });
    } catch (e) {
      setFileErr((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold tracking-tight text-zinc-900">
            Dettaglio progetto
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            Carica un solo preventivo attivo (PDF/DOCX). Poi faremo Risk
            Analysis e Scope Check.
          </div>
        </div>

        <a
          href="/dashboard"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          ← Dashboard
        </a>
      </div>

      {/* Upload card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Preventivo
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Supportati: PDF, DOCX • max 20MB
            </div>
          </div>

          <label className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
            {uploading ? "Caricamento..." : "Carica file"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </label>
        </div>

        {fileErr && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {fileErr}
          </div>
        )}

        {/* Active doc */}
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          {!activeDoc ? (
            <div className="text-sm text-zinc-600">
              Nessun preventivo caricato.
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {activeDoc.originalName}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {new Date(activeDoc.createdAt).toLocaleString("it-IT")} •{" "}
                  {activeDoc.mimeType}
                </div>
              </div>
              <a
                href={activeDoc.blobUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Apri
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Storico */}
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-900">
            Storico upload
          </div>
          <div className="text-xs text-zinc-500">{docs.length} file</div>
        </div>

        {docsQuery.isLoading ? (
          <div className="p-4">
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">
            Nessun file nello storico.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">
                      {d.originalName}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(d.createdAt).toLocaleString("it-IT")}
                      {d.isActive ? " • attivo" : ""}
                    </div>
                  </div>
                  <a
                    href={d.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Apri
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
