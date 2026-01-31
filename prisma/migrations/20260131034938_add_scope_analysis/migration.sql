-- CreateTable
CREATE TABLE "ScopeAnalysis" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopeAnalysis_documentId_key" ON "ScopeAnalysis"("documentId");

-- AddForeignKey
ALTER TABLE "ScopeAnalysis" ADD CONSTRAINT "ScopeAnalysis_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
