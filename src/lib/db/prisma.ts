import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  // DEV: sempre DATABASE_URL diretto
  if (process.env.NODE_ENV !== "production") {
    if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
    return new PrismaClient();
  }

  // PROD: Accelerate
  const accelerateUrl = process.env.PRISMA_ACCELERATE_URL;
  if (!accelerateUrl) throw new Error("Missing PRISMA_ACCELERATE_URL");
  return new PrismaClient({ accelerateUrl });
}

export const prisma = global.__prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
