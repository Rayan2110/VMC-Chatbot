// Single Prisma client instance — imported by API and any other consumer
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

module.exports = { prisma };
