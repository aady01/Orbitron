import { realtime } from "inngest";
import { z } from "zod";

import { GEMINI_CHANNEL_NAME } from "./constants";

export const geminiChannel = realtime.channel({
  name: GEMINI_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
