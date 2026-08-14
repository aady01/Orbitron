import { realtime } from "inngest";
import { z } from "zod";

import { OPENAI_CHANNEL_NAME } from "./constants";

export const openAiChannel = realtime.channel({
  name: OPENAI_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
