"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import { inngest } from "@/inngest/client";

export async function fetchHttpRequestRealtimeToken() {
  const token = await getClientSubscriptionToken(inngest, {
    channel: httpRequestChannel,
    topics: ["status"],
  });

  return token;
};
