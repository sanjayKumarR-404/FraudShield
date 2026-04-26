import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * We reuse one instance across the entire server to avoid exhausting DB connections.
 */
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

export default prisma;
