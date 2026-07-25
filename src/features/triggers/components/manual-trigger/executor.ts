import type { NodeExecutor } from "@/features/executions/types";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";
import { inngest } from "@/inngest/client";

    type ManualTriggerExecutor = Record<string, unknown>;

export const manualTriggerExecutor: NodeExecutor<ManualTriggerExecutor> = async ({
    nodeId,
    context,
    step,
}) =>{
    await inngest.realtime.publish(manualTriggerChannel.status, {
        nodeId,
        status: "loading",
    });

    const result = await step.run("manual-trigger",async()=>context);

    await inngest.realtime.publish(manualTriggerChannel.status, {
        nodeId,
        status: "success",
    });

    return result;
}