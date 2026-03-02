-- CreateTable
CREATE TABLE "DocumentChapter" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "level" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentChapter_documentId_idx" ON "DocumentChapter"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentChapter" ADD CONSTRAINT "DocumentChapter_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
