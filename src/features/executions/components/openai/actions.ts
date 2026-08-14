"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { openAiChannel } from "@/inngest/channels/openai";
import { inngest } from "@/inngest/client";

export async function fetchOpenAiRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: openAiChannel,
    topics: ["status"],
  });

  return token;
};
