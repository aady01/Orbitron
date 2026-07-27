import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  pool: Pool;
  adapter: PrismaPg;
};

// Create PostgreSQL connection pool, caching it in development
const pool = 
  globalForPrisma.pool || 
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

// Create Prisma adapter, caching it in development
const adapter = globalForPrisma.adapter || new PrismaPg(pool);

// Initialize Prisma Client with adapter
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.adapter = adapter;
  globalForPrisma.prisma = prisma;
}

export default prisma;
