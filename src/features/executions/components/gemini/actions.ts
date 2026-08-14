"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { geminiChannel } from "@/inngest/channels/gemini";
import { inngest } from "@/inngest/client";

export async function fetchGeminiRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: geminiChannel,
    topics: ["status"],
  });

  return token;
};
