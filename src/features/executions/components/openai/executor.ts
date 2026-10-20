// @ts-ignore
import Handlebars from "handlebars/dist/handlebars.js";
import { NonRetriableError } from "inngest";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { NodeExecutor } from "@/features/executions/types";
import { openAiChannel } from "@/inngest/channels/openai";
import { inngest } from "@/inngest/client";
import { CredentialType } from "@/generated/prisma";
import { resolveCredentialSecret } from "@/features/credentials/server/credential-vault";

Handlebars.registerHelper("json", (context: any) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type OpenAiData = {
  variableName?: string;
  credentialId?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

export const openAiExecutor: NodeExecutor<OpenAiData> = async ({
  data,
  nodeId,
  ownerId,
  context,
  step,
}) => {
  // Non-durable publish for transient "loading" status
  await inngest.realtime.publish(openAiChannel.status, {
    nodeId,
    status: "loading",
  });

  if (!data.variableName) {
    await step.realtime.publish(`openai-${nodeId}-error-var`, openAiChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("OpenAi node: Variable name is missing");
  }

  if (!data.credentialId) {
    await step.realtime.publish(`openai-${nodeId}-error-cred`, openAiChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("OpenAI node: Credential is required");
  }

  if (!data.userPrompt) {
    await step.realtime.publish(`openai-${nodeId}-error-prompt`, openAiChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("OpenAi node: User prompt is missing");
  }

  const systemPrompt = data.systemPrompt
    ? Handlebars.compile(data.systemPrompt)(context)
    : "You are a helpful assistant.";
  const userPrompt = Handlebars.compile(data.userPrompt)(context);

  const credential = await step.run(`openai-${nodeId}-get-credential`, () => {
    return resolveCredentialSecret({
      credentialId: data.credentialId!,
      ownerId,
      expectedType: CredentialType.OPENAI,
    });
  });

  if (!credential.ok) {
    await step.realtime.publish(`openai-${nodeId}-error-credential`, openAiChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError(`OpenAI node: ${credential.message}`);
  }

  const openai = createOpenAI({
    apiKey: credential.secret,
  });

  try {
    const result = await step.run(`openai-${nodeId}-execute`, async () => {
      const response = await generateText({
        model: openai("gpt-4"),
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
    await step.realtime.publish(`openai-${nodeId}-success`, openAiChannel.status, {
      nodeId,
      status: "success",
    });

    return result;
  } catch (error) {
    // Durable publish for "error" — memoized
    await step.realtime.publish(`openai-${nodeId}-error-catch`, openAiChannel.status, {
      nodeId,
      status: "error",
    });
    throw error;
  }
};
