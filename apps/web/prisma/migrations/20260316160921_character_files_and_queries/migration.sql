-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterFile" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "label" TEXT,
    "originalFileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "extractedTextLength" INTEGER,
    "extractedPageCount" INTEGER,
    "extractionDurationMs" INTEGER,
    "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
    "extractionError" TEXT,
    "extractedAt" TIMESTAMP(3),
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterChunk" (
    "id" TEXT NOT NULL,
    "characterFileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "chapterHint" TEXT,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Character_groupId_createdAt_idx" ON "Character"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "Character_ownerUserId_createdAt_idx" ON "Character"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CharacterFile_characterId_createdAt_idx" ON "CharacterFile"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "CharacterFile_characterId_isListed_createdAt_idx" ON "CharacterFile"("characterId", "isListed", "createdAt");

-- CreateIndex
CREATE INDEX "CharacterChunk_characterFileId_chunkIndex_idx" ON "CharacterChunk"("characterFileId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFile" ADD CONSTRAINT "CharacterFile_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFile" ADD CONSTRAINT "CharacterFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFile" ADD CONSTRAINT "CharacterFile_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "CharacterFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterChunk" ADD CONSTRAINT "CharacterChunk_characterFileId_fkey" FOREIGN KEY ("characterFileId") REFERENCES "CharacterFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
