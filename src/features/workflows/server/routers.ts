import { generateSlug } from "random-word-slugs";
import prisma from "@/lib/db";
import type { Node , Edge } from "@xyflow/react";
import { CredentialType, NodeType } from "@/generated/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PAGINATION } from "@/config/constants";
import { sendWorkflowExecution } from "@/inngest/utils";

const credentialTypeByNodeType: Partial<Record<NodeType, CredentialType>> = {
  [NodeType.OPENAI]: CredentialType.OPENAI,
  [NodeType.ANTHROPIC]: CredentialType.ANTHROPIC,
  [NodeType.GEMINI]: CredentialType.GEMINI,
};

export const workflowsRouter = createTRPCRouter({
  execute: protectedProcedure
  .input(z.object({id:z.string()}))
  .mutation(async({input, ctx})=>{
    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: {
        id: input.id,
        userId : ctx.auth.user.id
      }
    })

    await sendWorkflowExecution({
      workflowId: input.id,
    })

    return workflow
  }),


  create: protectedProcedure.mutation(({ ctx }) => {
    return prisma.workflow.create({
      data: {
        name: generateSlug(3),
        userId: ctx.auth.user.id,
        nodes: {
          create: {
            type: NodeType.INITIAL,
            position: { x: 0, y: 0 },
            name: NodeType.INITIAL,
          },
        },
      },
    });
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.delete({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
      });
    }),

    update: protectedProcedure
    .input(
      z.object({ 
        id: z.string(), 
        nodes:z.array(
          z.object({
            id:z.string(),
            type: z.string().nullish(),
            position: z.object({x: z.number(),y: z.number()}),
            data: z.record(z.string(),z.any()).optional()
          })
        ),
        edges: z.array(
          z.object({
            source: z.string(),
            target: z.string(),
            sourceHandle: z.string().nullish(),
            targetHandle: z.string().nullish()
          })
        )
      }))
    .mutation(async ({ ctx, input }) => {
      const {id,nodes,edges} = input
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where:{id,userId: ctx.auth.user.id}
      })

      const credentialIds = [
        ...new Set(
          nodes
            .map((node) => node.data?.credentialId)
            .filter((credentialId): credentialId is string =>
              typeof credentialId === "string" && credentialId.length > 0
            )
        ),
      ]

      if (credentialIds.length > 0) {
        const credentials = await prisma.credential.findMany({
          where: {
            id: { in: credentialIds },
            userId: ctx.auth.user.id,
          },
          select: {
            id: true,
            type: true,
          },
        });
        const credentialsById = new Map(
          credentials.map((credential) => [credential.id, credential])
        );

        for (const node of nodes) {
          const credentialId = node.data?.credentialId;

          if (typeof credentialId !== "string" || credentialId.length === 0) {
            continue;
          }

          const expectedType = node.type
            ? credentialTypeByNodeType[node.type as NodeType]
            : undefined;

          if (!expectedType) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Node "${node.id}" does not support credentials`,
            });
          }

          const credential = credentialsById.get(credentialId);

          if (!credential) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Credential "${credentialId}" was not found`,
            });
          }

          if (credential.type !== expectedType) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Credential "${credentialId}" must be of type ${expectedType}`,
            });
          }
        }
      }

      return await prisma.$transaction(async(tnx)=>{

        await tnx.node.deleteMany({
          where:{workflowId:id}
        })

        await tnx.node.createMany({
        data: nodes.map((node)=>({
          id:node.id,
          workflowId : id,
          name: node.type || "unknown",
          type: node.type as NodeType,
          position: node.position,
          data: node.data || {},
          credentialId:
            typeof node.data?.credentialId === "string"
              ? node.data.credentialId
              : null,
        })),
        })

        await tnx.connection.createMany({
          data: edges.map((edge)=>({
            workflowId: id,
            fromNodeId: edge.source,
            toNodeId: edge.target,
            fromOutput: edge.sourceHandle || "main",
            toInput: edge.targetHandle || "main"
          }))
        })

        await tnx.workflow.update({
          where: {id},
          data:{updatedAt: new Date()}
        })
        return workflow;
      })
    }),

  updateName: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.update({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
        data: { name: input.name },
      });
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.auth.user.id },
        include: { nodes: true, connections: true },
      });

      // this tarsforms server nodes to react-flow compatible nodes.
      const nodes : Node[] = workflow.nodes.map((node)=>({
        id: node.id,
        type: node.type,
        position: node.position as {x:number, y: number},
        data: (node.data as Record<string,unknown>)
      }))
      // trasforms server connection to react-flow compatible connection.
      const edges : Edge[] = workflow.connections.map((connection)=>({
        id:connection.id,
        source: connection.fromNodeId,
        target: connection.toNodeId,
        sourceHandle: connection.fromOutput,
        targetHandle: connection.toInput
      }))

      return {
        id: workflow.id,
        name: workflow.name,
        nodes,
        edges
      }
    
    }),
    
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().default(""),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;

      const [items, totalCount] = await Promise.all([
        prisma.workflow.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: {
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        }),
        prisma.workflow.count({
          where: { userId: ctx.auth.user.id },
        }),
      ]);
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };
    }),
});
