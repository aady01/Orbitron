// @ts-ignore
import Handlebars from "handlebars/dist/handlebars.js";
import { NonRetriableError } from "inngest";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { NodeExecutor } from "@/features/executions/types";
import { anthropicChannel } from "@/inngest/channels/anthropic";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";

Handlebars.registerHelper("json", (context: any) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type AnthropicData = {
  variableName?: string;
  credentialId?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

export const anthropicExecutor: NodeExecutor<AnthropicData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  // Non-durable publish for transient "loading" status
  await inngest.realtime.publish(anthropicChannel.status, {
    nodeId,
    status: "loading",
  });

  if (!data.variableName) {
    await step.realtime.publish(`anthropic-${nodeId}-error-var`, anthropicChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Anthropic node: Variable name is missing");
  }

  if (!data.credentialId) {
    await step.realtime.publish(`anthropic-${nodeId}-error-cred`, anthropicChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Anthropic node: Credential is required");
  }

  if (!data.userPrompt) {
    await step.realtime.publish(`anthropic-${nodeId}-error-prompt`, anthropicChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Anthropic node: User prompt is missing");
  }

  const systemPrompt = data.systemPrompt
    ? Handlebars.compile(data.systemPrompt)(context)
    : "You are a helpful assistant.";
  const userPrompt = Handlebars.compile(data.userPrompt)(context);

  const credential = await step.run(`anthropic-${nodeId}-get-credential`, () => {
    return prisma.credential.findUnique({
      where: {
        id: data.credentialId,
      },
    });
  });

  if (!credential) {
    throw new NonRetriableError("Anthropic node: Credential not found");
  }

  const anthropic = createAnthropic({
    apiKey: decrypt(credential.value),
  });

  try {
    const result = await step.run(`anthropic-${nodeId}-execute`, async () => {
      const response = await generateText({
        model: anthropic("claude-sonnet-4-5"),
        system: systemPrompt,
        prompt: userPrompt,
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        },
      });

      const text = response.text || "";

      return {
        ...context,
        [data.variableName!]: {
          text,
        },
      };
    });

    // Durable publish for "success" — memoized, won't re-fire on retry
    await step.realtime.publish(`anthropic-${nodeId}-success`, anthropicChannel.status, {
      nodeId,
      status: "success",
    });

    return result;
  } catch (error) {
    // Durable publish for "error" — memoized
    await step.realtime.publish(`anthropic-${nodeId}-error-catch`, anthropicChannel.status, {
      nodeId,
      status: "error",
    });
    throw error;
  }
};
