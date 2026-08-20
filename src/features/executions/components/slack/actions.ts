"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { slackChannel } from "@/inngest/channels/slack";
import { inngest } from "@/inngest/client";

export async function fetchSlackRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: slackChannel,
    topics: ["status"],
  });

  return token;
};
