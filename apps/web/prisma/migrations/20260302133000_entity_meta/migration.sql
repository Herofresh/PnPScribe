ALTER TABLE "Document"
ADD COLUMN "entityMetaStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN "entityMetaError" TEXT,
ADD COLUMN "entityMetaModel" TEXT,
ADD COLUMN "entityMetaJson" JSONB,
ADD COLUMN "entityMetaUpdatedAt" TIMESTAMP(3);
