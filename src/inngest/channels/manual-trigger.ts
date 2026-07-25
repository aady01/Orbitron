import { realtime } from "inngest";
import { z } from "zod";

import { MANUAL_TRIGGER_CHANNEL_NAME } from "./constants";

export const manualTriggerChannel = realtime.channel({
  name: MANUAL_TRIGGER_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
