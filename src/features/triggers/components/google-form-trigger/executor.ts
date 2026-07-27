import type { NodeExecutor } from "@/features/executions/types";
import { googleFormTriggerChannel } from "@/inngest/channels/google-form-trigger";
import { inngest } from "@/inngest/client";

type GoogleFormTriggerData = Record<string, unknown>;

export const googleFormTriggerExecutor: NodeExecutor<GoogleFormTriggerData> = async ({
    nodeId,
    context,
    step,
}) => {
    // Non-durable publish for transient "loading" status
    await inngest.realtime.publish(googleFormTriggerChannel.status, {
        nodeId,
        status: "loading",
    });

    const result = await step.run(`google-form-trigger-${nodeId}-execute`, async () => context);

    // Durable publish for "success" — memoized, won't re-fire on retry
    await step.realtime.publish(`google-form-trigger-${nodeId}-success`, googleFormTriggerChannel.status, {
        nodeId,
        status: "success",
    });

    return result;
};
