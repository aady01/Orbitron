import { realtime } from "inngest";
import { z } from "zod";

import { SLACK_CHANNEL_NAME } from "./constants";

export const slackChannel = realtime.channel({
  name: SLACK_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
