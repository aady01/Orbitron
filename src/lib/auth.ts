import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import prisma from "@/lib/db";

const trustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://*.ngrok-free.dev",
  "https://*.ngrok-free.app",
  "https://*.ngrok.app",
  "https://*.ngrok.io",
  "https://*.loca.lt",
  ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim())
    : []),
  ...(process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim())
    : []),
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // Fixed: was incorrectly set to "sqlite"
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins,
});
