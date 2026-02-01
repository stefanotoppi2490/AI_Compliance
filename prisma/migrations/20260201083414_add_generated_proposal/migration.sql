-- CreateTable
CREATE TABLE "GeneratedProposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markdown" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'text/markdown; charset=utf-8',
    "inputMeta" JSONB,

    CONSTRAINT "GeneratedProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedProposal_projectId_createdAt_idx" ON "GeneratedProposal"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedProposal_documentId_idx" ON "GeneratedProposal"("documentId");

-- AddForeignKey
ALTER TABLE "GeneratedProposal" ADD CONSTRAINT "GeneratedProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedProposal" ADD CONSTRAINT "GeneratedProposal_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
