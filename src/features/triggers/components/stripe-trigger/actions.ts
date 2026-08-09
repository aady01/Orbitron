"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { stripeTriggerChannel } from "@/inngest/channels/stripe-trigger";
import { inngest } from "@/inngest/client";

export async function fetchStripeTriggerRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: stripeTriggerChannel,
    topics: ["status"],
  });

  return token;
}
