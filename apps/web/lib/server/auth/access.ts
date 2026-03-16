import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export async function requireSessionUser() {
  const session = await auth();
  const user = session?.user;

  if (user?.id == null || user.id === "") {
    throw new HttpError(401, "Authentication required.");
  }

  return user;
}

export async function requireGmUser() {
  const user = await requireSessionUser();

  if (user.gmEnabled !== true) {
    throw new HttpError(403, "GM mode is required.");
  }

  return user;
}

export async function requireOwnedSystem(systemId: string) {
  const user = await requireSessionUser();
  const system = await prisma.system.findUnique({
    where: { id: systemId },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!system || system.ownerId !== user.id) {
    throw new HttpError(404, "System not found.");
  }

  return {
    user,
    system,
  };
}

export async function requireOwnedDocument(documentId: string) {
  const user = await requireSessionUser();
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      systemId: true,
      system: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!document || document.system.ownerId !== user.id) {
    throw new HttpError(404, "Document not found.");
  }

  return {
    user,
    document,
  };
}

export async function requireOwnedEntity(entityId: string) {
  const user = await requireSessionUser();
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      documentId: true,
      systemId: true,
      system: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (entity == null || entity.system.ownerId !== user.id) {
    throw new HttpError(404, "Entity not found.");
  }

  return {
    user,
    entity,
  };
}
