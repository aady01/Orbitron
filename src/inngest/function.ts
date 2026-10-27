import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import prisma from "@/lib/db";
import { createExecutionPlan, runExecutionPlan } from "./execution-plan";
import { ExecutionStatus, NodeType, type Prisma } from "@/generated/prisma";
import { getExecutor } from "@/features/executions/lib/executor-registry";

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    retries: 0, // TODO: REMOVE IN PRODUCTION
    onFailure: async ({ event }) => {
      return prisma.execution.update({
        where: { inngestEventId: event.data.event.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: event.data.error.message,
          errorStack: event.data.error.stack,
        },
      });
    },
    triggers: [{ event: "workflows/execute.workflow" as const }],
  },
  async ({ event, step }) => {
    const inngestEventId = event.id;
    const workflowId = event.data.workflowId;

    if (!inngestEventId || !workflowId) {
      throw new NonRetriableError("Event ID or workflow ID is missing");
    }

    await step.run("create-execution", async () => {
      return prisma.execution.create({
        data: {
          workflowId,
          inngestEventId,
        },
      });
    });

    const triggerNodeId =
      typeof event.data.triggerNodeId === "string" &&
      event.data.triggerNodeId.length > 0
        ? event.data.triggerNodeId
        : undefined;
    const triggerType =
      typeof event.data.triggerType === "string"
        ? (event.data.triggerType as NodeType)
        : undefined;

    const { plan, nodes, ownerId } = await step.run("prepare-workflow", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: {
          id: workflowId,
        },
        include: {
          nodes: true,
          connections: true
        }
      })

      return {
        plan: createExecutionPlan({
          nodes: workflow.nodes,
          connections: workflow.connections,
          entryNodeId: triggerNodeId,
          entryNodeType: triggerType,
        }),
        nodes: workflow.nodes,
        ownerId: workflow.userId,
      }
    })

    const initialContext = event.data.initialData || {};
    const context = await runExecutionPlan({
      plan,
      nodes,
      initialContext,
      execute: (node, stageContext) => {
        const executor = getExecutor(node.type);
        return executor({
          data: node.data as Record<string, unknown>,
          nodeId: node.id,
          ownerId,
          context: stageContext,
          step,
        });
      },
    });

    await step.run("update-execution", async () => {
      return prisma.execution.update({
        where: { inngestEventId, workflowId },
        data: {
          status: ExecutionStatus.SUCCESS,
          completedAt: new Date(),
          output: context as Prisma.InputJsonValue,
        },
      })
    });

    return {
      workflowId,
      result: context,
    };
  }
)