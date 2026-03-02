import "server-only";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export function parseEntityType(input: unknown): "monster" | "item" | undefined {
  return input === "monster" || input === "item" ? input : undefined;
}

export async function listEntitiesForSystem(params: {
  systemId: string;
  type?: "monster" | "item";
  documentId?: string;
  q?: string;
}) {
  const system = await prisma.system.findUnique({
    where: { id: params.systemId },
    select: { id: true, name: true },
  });

  if (!system) {
    throw new HttpError(404, "System not found.");
  }

  const entities = await prisma.entity.findMany({
    where: {
      systemId: params.systemId,
      ...(params.type ? { type: params.type } : {}),
      ...(params.documentId ? { documentId: params.documentId } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" } },
              { slug: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      documentId: true,
      type: true,
      name: true,
      slug: true,
      confidence: true,
      sourcePageStart: true,
      sourcePageEnd: true,
      sourceChunkStart: true,
      sourceChunkEnd: true,
      extractionMethod: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          images: true,
          ruleLinks: true,
        },
      },
    },
    take: 200,
  });

  return {
    system,
    entities,
  };
}

export async function getEntityById(entityId: string) {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    include: {
      group: true,
      document: {
        select: {
          id: true,
          filePath: true,
          systemId: true,
        },
      },
      images: {
        orderBy: { pageNumber: "asc" },
      },
      _count: {
        select: {
          ruleLinks: true,
        },
      },
    },
  });

  if (!entity) {
    throw new HttpError(404, "Entity not found.");
  }

  return entity;
}

export async function getEntityRuleLinks(entityId: string) {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      name: true,
      type: true,
      documentId: true,
      systemId: true,
    },
  });

  if (!entity) {
    throw new HttpError(404, "Entity not found.");
  }

  const links = await prisma.entityRuleLink.findMany({
    where: { entityId },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    include: {
      chunk: {
        select: {
          id: true,
          chunkIndex: true,
          pageNumber: true,
          chapterHint: true,
          kind: true,
          content: true,
        },
      },
    },
    take: 100,
  });

  return {
    entity,
    links,
  };
}
