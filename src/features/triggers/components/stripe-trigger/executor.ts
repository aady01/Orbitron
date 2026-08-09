import type { NodeExecutor } from "@/features/executions/types";
import { stripeTriggerChannel } from "@/inngest/channels/stripe-trigger";
import { inngest } from "@/inngest/client";

type StripeTriggerData = Record<string, unknown>;

export const stripeTriggerExecutor: NodeExecutor<StripeTriggerData> = async ({
    nodeId,
    context,
    step,
}) => {
    // Non-durable publish for transient "loading" status
    await inngest.realtime.publish(stripeTriggerChannel.status, {
        nodeId,
        status: "loading",
    });

    const result = await step.run(`stripe-trigger-${nodeId}-execute`, async () => context);

    // Durable publish for "success" — memoized, won't re-fire on retry
    await step.realtime.publish(`stripe-trigger-${nodeId}-success`, stripeTriggerChannel.status, {
        nodeId,
        status: "success",
    });

    return result;
};
