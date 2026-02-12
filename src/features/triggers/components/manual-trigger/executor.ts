import type { NodeExecutor } from "@/features/executions/types";

    type ManualTriggerExecutor = Record<string, unknown>;

export const manualTriggerExecutor: NodeExecutor<ManualTriggerExecutor> = async ({
    nodeId,
    context,
    step,
}) =>{
    const result = await step.run("manual-trigger",async()=>context)
    return result
}