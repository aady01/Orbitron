import { realtime } from "inngest";
import { z } from "zod";

import { HTTP_REQUEST_CHANNEL_NAME } from "./constants";

export const httpRequestChannel = realtime.channel({
  name: HTTP_REQUEST_CHANNEL_NAME,
  topics: {
    status: {
      schema: z.object({
        nodeId: z.string(),
        status: z.enum(["loading", "success", "error"]),
      }),
    },
  },
});
