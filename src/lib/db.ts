import { PrismaClient } from "@prisma/client";

/**
 * The subset of the generated Memory delegate used by this application.
 * Keeping this declaration here lets the editor recover gracefully while
 * Prisma regenerates its client after schema changes.
 */
type MemoryDelegate = {
  findMany(args?: unknown): Promise<MemoryRecord[]>;
  findFirst(args?: unknown): Promise<MemoryRecord | null>;
  create(args: unknown): Promise<MemoryRecord>;
  update(args: unknown): Promise<MemoryRecord>;
  delete(args: unknown): Promise<MemoryRecord>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
};

export type MemoryRecord = {
  id: string;
  userId: string;
  content: string;
  embedding: string;
  sourceConvId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AppPrismaClient = PrismaClient & { memory: MemoryDelegate };

const globalForPrisma = globalThis as unknown as { prisma?: AppPrismaClient };

export const db = globalForPrisma.prisma ?? (new PrismaClient() as AppPrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
