import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { NodeExecutor } from "@/features/executions/types";
import { geminiChannel } from "@/inngest/channels/gemini";
import { inngest } from "@/inngest/client";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type GeminiData = {
  variableName?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

export const geminiExecutor: NodeExecutor<GeminiData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  // Non-durable publish for transient "loading" status
  await inngest.realtime.publish(geminiChannel.status, {
    nodeId,
    status: "loading",
  });

  if (!data.variableName) {
    await step.realtime.publish(`gemini-${nodeId}-error-var`, geminiChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Gemini node: Variable name is missing");
  }

  if (!data.userPrompt) {
    await step.realtime.publish(`gemini-${nodeId}-error-prompt`, geminiChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Gemini node: User prompt is missing");
  }

  const systemPrompt = data.systemPrompt
    ? Handlebars.compile(data.systemPrompt)(context)
    : "You are a helpful assistant.";
  const userPrompt = Handlebars.compile(data.userPrompt)(context);

  // TODO: Fetch credential that user selected
  const credentialValue = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;

  const google = createGoogleGenerativeAI({
    apiKey: credentialValue,
  });

  try {
    const result = await step.run(`gemini-${nodeId}-execute`, async () => {
      const response = await generateText({
        model: google("gemini-2.0-flash"),
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
    await step.realtime.publish(`gemini-${nodeId}-success`, geminiChannel.status, {
      nodeId,
      status: "success",
    });

    return result;
  } catch (error) {
    // Durable publish for "error" — memoized
    await step.realtime.publish(`gemini-${nodeId}-error-catch`, geminiChannel.status, {
      nodeId,
      status: "error",
    });
    throw error;
  }
};
