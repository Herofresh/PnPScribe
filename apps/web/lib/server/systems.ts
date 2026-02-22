import "server-only";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

export async function listSystems() {
  return prisma.system.findMany({
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

export async function createSystem(name: string) {
  return prisma.system.create({
    data: { name },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
}
