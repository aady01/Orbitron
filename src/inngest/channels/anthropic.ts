import { realtime } from "inngest";
import { z } from "zod";

import { ANTHROPIC_CHANNEL_NAME } from "./constants";

export const anthropicChannel = realtime.channel({
  name: ANTHROPIC_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
