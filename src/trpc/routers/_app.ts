import { inngest } from "@/inngest/client";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";
import prisma from "@/lib/db";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export const appRouter = createTRPCRouter({
  testai: baseProcedure.mutation(async () => {
    await inngest.send({
      name: "execute/ai",
    });

    return { sucess: true, message: "Job Queued" };
  }),

  getUsers: protectedProcedure.query(async ({ ctx }) => {
    return prisma.user.findMany();
  }),
  getWorkflow: protectedProcedure.query(({ ctx }) => {
    return prisma.workflow.findMany();
  }),
  createWorkflow: protectedProcedure.mutation(async () => {
    await inngest.send({
      name: "test/hello.world",
      data: {
        email: "aady@gmail.com",
      },
    });
    return { sucess: true, message: "Job Queued" };
  }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
