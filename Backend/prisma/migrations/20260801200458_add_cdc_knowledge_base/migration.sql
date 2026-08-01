-- CreateTable
CREATE TABLE "cdc_knowledge_documents" (
    "id" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdc_knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cdc_knowledge_documents_sourceFilename_idx" ON "cdc_knowledge_documents"("sourceFilename");
