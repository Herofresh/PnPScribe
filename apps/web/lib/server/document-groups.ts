import "server-only";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export async function listGroupsForDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      systemId: true,
      filePath: true,
      createdAt: true,
    },
  });

  if (!document) {
    throw new HttpError(404, "Document not found.");
  }

  const groups = await prisma.chunkGroup.findMany({
    where: { documentId },
    orderBy: { groupIndex: "asc" },
    include: {
      _count: {
        select: {
          chunks: true,
          entities: true,
        },
      },
    },
  });

  return {
    document,
    groups,
  };
}
