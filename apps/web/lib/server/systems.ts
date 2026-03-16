import "server-only";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export async function listSystemsForOwner(ownerId: string) {
  return prisma.system.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
}

export function parseSystemName(input: unknown) {
  const name = typeof input === "string" ? input.trim().slice(0, 120) : "";

  if (!name) {
    throw new HttpError(400, "System name is required.");
  }

  return name;
}

export async function createSystem(name: string, ownerId: string) {
  return prisma.system.create({
    data: { name, ownerId },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
}
