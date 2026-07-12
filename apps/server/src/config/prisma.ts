import { PrismaClient } from "@prisma/client";

// Singleton pattern: reuse the same PrismaClient instance across hot-reloads
// in development, and maintain a single connection pool in production.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
