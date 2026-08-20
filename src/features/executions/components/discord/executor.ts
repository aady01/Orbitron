// @ts-ignore
import Handlebars from "handlebars/dist/handlebars.js";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { discordChannel } from "@/inngest/channels/discord";
import { inngest } from "@/inngest/client";
import ky from "ky";

Handlebars.registerHelper("json", (context: any) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type DiscordData = {
  variableName?: string;
  webhookUrl?: string;
  content?: string;
  username?: string;
};

export const discordExecutor: NodeExecutor<DiscordData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  // Non-durable publish for transient "loading" status
  await inngest.realtime.publish(discordChannel.status, {
    nodeId,
    status: "loading",
  });

  if (!data.variableName) {
    await step.realtime.publish(`discord-${nodeId}-error-var`, discordChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Discord node: Variable name is missing");
  }

  if (!data.content) {
    await step.realtime.publish(`discord-${nodeId}-error-content`, discordChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Discord node: Message content is required");
  }

  if (!data.webhookUrl) {
    await step.realtime.publish(`discord-${nodeId}-error-url`, discordChannel.status, {
      nodeId,
      status: "error",
    });
    throw new NonRetriableError("Discord node: Webhook URL is required");
  }

  const rawContent = Handlebars.compile(data.content)(context);
  const content = decode(rawContent);
  const username = data.username
    ? decode(Handlebars.compile(data.username)(context))
    : undefined;

  try {
    const result = await step.run(`discord-${nodeId}-webhook`, async () => {
      await ky.post(data.webhookUrl!, {
        json: {
          content: content.slice(0, 2000), // Discord's max message length
          username,
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
    await step.realtime.publish(`discord-${nodeId}-success`, discordChannel.status, {
      nodeId,
      status: "success",
    });

    return result;
  } catch (error) {
    // Durable publish for "error" — memoized
    await step.realtime.publish(`discord-${nodeId}-error-catch`, discordChannel.status, {
      nodeId,
      status: "error",
    });
    throw error;
  }
};
