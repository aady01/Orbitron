"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { discordChannel } from "@/inngest/channels/discord";
import { inngest } from "@/inngest/client";

export async function fetchDiscordRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: discordChannel,
    topics: ["status"],
  });

  return token;
};
