import { PrismaClient } from '@prisma/client';
import dotenv from "dotenv";

dotenv.config();

// Use pooled connection for runtime operations
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("[database]: Connected to Supabase Postgres via Prisma successfully");
  } catch (error) {
    console.error("[database]: Prisma connection failed", error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await prisma.$disconnect();
};

export { prisma, connectDB, disconnectDB };
