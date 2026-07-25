import { useRealtime } from "inngest/react";
import { useEffect, useState } from "react";
import type { NodeStatus } from "@/components/react-flow/node-status-indicator";

interface UseNodeStatusOptions {
  nodeId: string;
  channel: string;
  topic: string;
  refreshToken: () => Promise<{ key: string; apiBaseUrl?: string }>;
};

export function useNodeStatus({
  nodeId,
  channel,
  topic,
  refreshToken,
}: UseNodeStatusOptions) {
  const [status, setStatus] = useState<NodeStatus>("initial");

  const { messages } = useRealtime({
    channel,
    topics: [topic] as const,
    token: refreshToken,
    enabled: true,
  });

  useEffect(() => {
    if (!messages.all.length) {
      return;
    }

    // Find the latest message for this node
    const latestMessage = messages.all
      .filter(
        (msg) => 
          msg.kind === "data" &&
          msg.channel === channel &&
          msg.topic === topic &&
          (msg.data as Record<string, unknown>)?.nodeId === nodeId,
      )
      .sort((a, b) => {
        if (a.kind === "data" && b.kind === "data") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        return 0;
      })[0];

    if (latestMessage?.kind === "data") {
      setStatus((latestMessage.data as Record<string, unknown>)?.status as NodeStatus);
    }
  }, [messages, nodeId, channel, topic]);

  return status;
};
