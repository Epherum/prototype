// lib/prisma.js
import { PrismaClient } from "@prisma/client";

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // Prevent multiple instances of Prisma Client in development
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      // log: ['query', 'info', 'warn', 'error'], // Optional: for verbose logging
    });
    console.log("Initialized new Prisma Client for development");
  }
  prisma = global.prisma;
}

export default prisma;
