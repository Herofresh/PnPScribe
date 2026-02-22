ALTER TABLE "Document"
ADD COLUMN "ocrMode" TEXT,
ADD COLUMN "ocrProgressCurrentPage" INTEGER,
ADD COLUMN "ocrProgressTotalPages" INTEGER,
ADD COLUMN "ocrProgressMessage" TEXT,
ADD COLUMN "ocrProgressUpdatedAt" TIMESTAMP(3);
