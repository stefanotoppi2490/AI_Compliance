-- CreateTable
CREATE TABLE "RequestCheck" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestCheck_documentId_createdAt_idx" ON "RequestCheck"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "RequestCheck" ADD CONSTRAINT "RequestCheck_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
