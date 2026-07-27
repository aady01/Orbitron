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

  const { messages, connectionStatus } = useRealtime({
    channel,
    topics: [topic] as const,
    token: refreshToken,
    enabled: true,
  });

  useEffect(() => {
    console.log(`[useNodeStatus] [${nodeId}] connection:`, connectionStatus);
    console.log(`[useNodeStatus] [${nodeId}] ALL messages:`, messages.all.length);
    if (!messages.all.length) {
      return;
    }

    // Find the latest message for this node
    const latestMessage = messages.all
      .filter(
        (msg) => {
          const isData = msg.kind === "data";
          const isChannelMatch = msg.channel === channel;
          const isTopicMatch = msg.topic === topic;
          const isNodeMatch = (msg.data as Record<string, unknown>)?.nodeId === nodeId;
          
          if (isData) {
              console.log(`[useNodeStatus] Filter check:`, { 
                  isChannelMatch, msgChannel: msg.channel, expectedChannel: channel,
                  isTopicMatch, msgTopic: msg.topic, expectedTopic: topic,
                  isNodeMatch, msgNodeId: (msg.data as Record<string, unknown>)?.nodeId, expectedNodeId: nodeId 
              });
          }
          
          return isData && isChannelMatch && isTopicMatch && isNodeMatch;
        }
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
      console.log(`[useNodeStatus] [${nodeId}] Setting status:`, (latestMessage.data as Record<string, unknown>)?.status);
      setStatus((latestMessage.data as Record<string, unknown>)?.status as NodeStatus);
    }
  }, [messages, nodeId, channel, topic, connectionStatus]);

  return status;
};
