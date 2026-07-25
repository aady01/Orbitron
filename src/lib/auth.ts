import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import prisma from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // Fixed: was incorrectly set to "sqlite"
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
});
