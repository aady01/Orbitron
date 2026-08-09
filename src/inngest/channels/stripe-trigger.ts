import { realtime } from "inngest";
import { z } from "zod";

import { STRIPE_TRIGGER_CHANNEL_NAME } from "./constants";

export const stripeTriggerChannel = realtime.channel({
  name: STRIPE_TRIGGER_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
