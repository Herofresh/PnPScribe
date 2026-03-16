import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export function parseGroupName(input: unknown) {
  const name = typeof input === "string" ? input.trim().slice(0, 120) : "";

  if (name === "") {
    throw new HttpError(400, "Group name is required.");
  }

  return name;
}

export function parseGroupDescription(input: unknown) {
  const description = typeof input === "string" ? input.trim().slice(0, 500) : "";
  return description === "" ? null : description;
}

export async function createGroup(params: {
  systemId: string;
  ownerId: string;
  name: string;
  description?: string | null;
}) {
  return prisma.group.create({
    data: {
      systemId: params.systemId,
      ownerId: params.ownerId,
      name: params.name,
      description: params.description ?? null,
    },
    select: {
      id: true,
      systemId: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });
}

export async function createInviteLink(params: {
  groupId: string;
  createdById: string;
}) {
  const token = randomBytes(24).toString("base64url");

  return prisma.inviteLink.create({
    data: {
      token,
      groupId: params.groupId,
      createdById: params.createdById,
    },
    select: {
      id: true,
      token: true,
      groupId: true,
      createdAt: true,
    },
  });
}

export async function getInviteLinkByToken(token: string) {
  const invite = await prisma.inviteLink.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      revokedAt: true,
      expiresAt: true,
      createdAt: true,
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          system: {
            select: {
              id: true,
              name: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (invite == null) {
    throw new HttpError(404, "Invite link not found.");
  }

  if (invite.revokedAt != null) {
    throw new HttpError(410, "Invite link has been revoked.");
  }

  if (invite.expiresAt != null && invite.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, "Invite link has expired.");
  }

  return invite;
}

export async function acceptInviteLink(params: {
  token: string;
  userId: string;
}) {
  const invite = await getInviteLinkByToken(params.token);

  const membership = await prisma.groupMembership.upsert({
    where: {
      groupId_userId: {
        groupId: invite.group.id,
        userId: params.userId,
      },
    },
    update: {},
    create: {
      groupId: invite.group.id,
      userId: params.userId,
      role: "player",
    },
    select: {
      id: true,
      groupId: true,
      userId: true,
      role: true,
      createdAt: true,
    },
  });

  return {
    invite,
    membership,
  };
}
