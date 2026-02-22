import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

function sanitizeFilename(name: string) {
  const normalized = name.trim().replace(/\s+/g, "-").toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]/g, "");
  return safe || "upload.pdf";
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function getSystemId(formData: FormData) {
  const systemIdValue = formData.get("systemId");
  const systemId = typeof systemIdValue === "string" ? systemIdValue.trim() : "";

  if (!systemId) {
    throw new HttpError(400, "systemId is required.");
  }

  return systemId;
}

function getUploadFile(formData: FormData) {
  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    throw new HttpError(400, "file is required.");
  }

  if (!isPdf(fileValue)) {
    throw new HttpError(400, "Only PDF uploads are supported.");
  }

  return fileValue;
}

export async function uploadDocumentFromFormData(formData: FormData) {
  const systemId = getSystemId(formData);
  const file = getUploadFile(formData);

  const system = await prisma.system.findUnique({
    where: { id: systemId },
    select: { id: true },
  });

  if (!system) {
    throw new HttpError(404, "System not found.");
  }

  const uploadsRoot = path.resolve(process.cwd(), "..", "..", "uploads");
  const systemDir = path.join(uploadsRoot, system.id);
  await mkdir(systemDir, { recursive: true });

  const safeName = sanitizeFilename(file.name);
  const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const absolutePath = path.join(systemDir, storedName);
  const relativePath = path.posix.join("uploads", system.id, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const document = await prisma.document.create({
    data: {
      systemId: system.id,
      filePath: relativePath,
    },
    select: {
      id: true,
      filePath: true,
      systemId: true,
      createdAt: true,
    },
  });

  return {
    document,
    file: {
      originalName: file.name,
      mimeType: file.type || "application/pdf",
      size: file.size,
    },
  };
}
