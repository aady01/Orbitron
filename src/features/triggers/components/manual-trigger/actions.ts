"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";
import { inngest } from "@/inngest/client";

export async function fetchManualTriggerRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: manualTriggerChannel,
    topics: ["status"],
  });

  return token;
};
