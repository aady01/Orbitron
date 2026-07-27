import type { NodeExecutor } from "@/features/executions/types";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";
import { inngest } from "@/inngest/client";

type ManualTriggerExecutor = Record<string, unknown>;

export const manualTriggerExecutor: NodeExecutor<ManualTriggerExecutor> = async ({
    nodeId,
    context,
    step,
}) => {
    // Non-durable publish for transient "loading" status
    await inngest.realtime.publish(manualTriggerChannel.status, {
        nodeId,
        status: "loading",
    });

    const result = await step.run(`manual-trigger-${nodeId}-execute`, async () => context);

    // Durable publish for "success" — memoized, won't re-fire on retry
    await step.realtime.publish(`manual-trigger-${nodeId}-success`, manualTriggerChannel.status, {
        nodeId,
        status: "success",
    });

    return result;
}