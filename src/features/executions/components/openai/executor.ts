import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { NodeExecutor } from "@/features/executions/types";
import { openAiChannel } from "@/inngest/channels/openai";
import { inngest } from "@/inngest/client";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type OpenAiData = {
  variableName?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

export const openAiExecutor: NodeExecutor<OpenAiData> = async ({
  data,
  nodeId,
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

  // TODO: Fetch credential that user selected
  const credentialValue = process.env.OPENAI_API_KEY!;

  const openai = createOpenAI({
    apiKey: credentialValue,
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
