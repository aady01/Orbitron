// @ts-ignore
import Handlebars from "handlebars/dist/handlebars.js";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { slackChannel } from "@/inngest/channels/slack";
import { inngest } from "@/inngest/client";
import ky from "ky";

Handlebars.registerHelper("json", (context: any) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type SlackData = {
  variableName?: string;
  webhookUrl?: string;
  content?: string;
};

export const slackExecutor: NodeExecutor<SlackData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  // Non-durable publish for transient "loading" status
  await inngest.realtime.publish(slackChannel.status, {
    nodeId,
    status: "loading",
  });

  if (!data.variableName) {
    await step.realtime.publish(`slack-${nodeId}-error-var`, slackChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Slack node: Variable name is missing");
  }

  if (!data.content) {
    await step.realtime.publish(`slack-${nodeId}-error-content`, slackChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Slack node: Message content is required");
  }

  if (!data.webhookUrl) {
    await step.realtime.publish(`slack-${nodeId}-error-url`, slackChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Slack node: Webhook URL is required");
  }

  const rawContent = Handlebars.compile(data.content)(context);
  const content = decode(rawContent);

  try {
    const result = await step.run(`slack-${nodeId}-webhook`, async () => {
      await ky.post(data.webhookUrl!, {
        json: {
          content, // The key depends on workflow config
        },
      });

      return {
        ...context,
        [data.variableName!]: {
          messageContent: content.slice(0, 2000),
        },
      };
    });

    // Durable publish for "success" — memoized, won't re-fire on retry
    await step.realtime.publish(`slack-${nodeId}-success`, slackChannel.status, {
      nodeId,
      status: "success",
    });

    return result;
  } catch (error) {
    // Durable publish for "error" — memoized
    await step.realtime.publish(`slack-${nodeId}-error-catch`, slackChannel.status, {
      nodeId,
      status: "error",
    });
    throw error;
  }
};
