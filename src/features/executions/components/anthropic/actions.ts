"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { anthropicChannel } from "@/inngest/channels/anthropic";
import { inngest } from "@/inngest/client";

export async function fetchAnthropicRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: anthropicChannel,
    topics: ["status"],
  });

  return token;
};
