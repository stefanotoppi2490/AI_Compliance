import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const accelerateUrl = process.env.PRISMA_ACCELERATE_URL;
  if (!accelerateUrl) {
    throw new Error("Missing PRISMA_ACCELERATE_URL");
  }

  return new PrismaClient({
    accelerateUrl,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
