import "server-only";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

function parseEmail(input: unknown) {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";

  if (!email) {
    throw new HttpError(400, "Email is required.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Email is invalid.");
  }

  return email;
}

function parsePassword(input: unknown) {
  const password = typeof input === "string" ? input : "";

  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }

  if (password.length > 200) {
    throw new HttpError(400, "Password is too long.");
  }

  return password;
}

function parseName(input: unknown) {
  const name = typeof input === "string" ? input.trim().slice(0, 120) : "";
  return name || null;
}

export async function registerUser(input: {
  email: unknown;
  password: unknown;
  name?: unknown;
}) {
  const email = parseEmail(input.email);
  const password = parsePassword(input.password);
  const name = parseName(input.name);

  const existingCount = await prisma.user.count();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        gmEnabled: existingCount === 0,
      },
      select: {
        id: true,
        email: true,
        gmEnabled: true,
      },
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "An account with this email already exists.");
    }

    throw error;
  }
}
