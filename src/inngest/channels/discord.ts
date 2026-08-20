import { realtime } from "inngest";
import { z } from "zod";

import { DISCORD_CHANNEL_NAME } from "./constants";

export const discordChannel = realtime.channel({
  name: DISCORD_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
