ALTER TABLE "Document"
ADD COLUMN "extractedText" TEXT,
ADD COLUMN "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "extractionError" TEXT,
ADD COLUMN "extractedAt" TIMESTAMP(3);
