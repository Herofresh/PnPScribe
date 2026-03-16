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

export async function requireGroupAccess(groupId: string) {
  const user = await requireSessionUser();
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      ownerId: true,
      systemId: true,
      memberships: {
        where: { userId: user.id },
        select: { id: true, role: true },
        take: 1,
      },
    },
  });

  const isMember = (group?.memberships.length ?? 0) > 0;
  const isOwner = group?.ownerId === user.id;

  if (group == null || (!isOwner && !isMember)) {
    throw new HttpError(404, "Group not found.");
  }

  return {
    user,
    group,
    isOwner,
    isMember,
  };
}

export async function requireCharacterAccess(characterId: string) {
  const user = await requireSessionUser();
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      ownerUserId: true,
      groupId: true,
      group: {
        select: {
          ownerId: true,
          systemId: true,
          memberships: {
            where: { userId: user.id },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const isCharacterOwner = character?.ownerUserId === user.id;
  const isGroupOwner = character?.group.ownerId === user.id;
  const isGroupMember = (character?.group.memberships.length ?? 0) > 0;

  if (character == null || (!isCharacterOwner && !isGroupOwner && !isGroupMember)) {
    throw new HttpError(404, "Character not found.");
  }

  return {
    user,
    character,
    isCharacterOwner,
    isGroupOwner,
    isGroupMember,
  };
}

export async function requireCharacterFileAccess(characterFileId: string) {
  const user = await requireSessionUser();
  const file = await prisma.characterFile.findUnique({
    where: { id: characterFileId },
    select: {
      id: true,
      characterId: true,
      isListed: true,
      character: {
        select: {
          ownerUserId: true,
          group: {
            select: {
              ownerId: true,
              memberships: {
                where: { userId: user.id },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const isCharacterOwner = file?.character.ownerUserId === user.id;
  const isGroupOwner = file?.character.group.ownerId === user.id;
  const isGroupMember = (file?.character.group.memberships.length ?? 0) > 0;

  if (file == null || (!isCharacterOwner && !isGroupOwner && !isGroupMember)) {
    throw new HttpError(404, "Character file not found.");
  }

  return {
    user,
    file,
    isCharacterOwner,
    isGroupOwner,
    isGroupMember,
  };
}
