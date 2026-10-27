import type { NodeType } from "@/generated/prisma"
import { inngest } from "./client"
import { createId } from "@paralleldrive/cuid2"

export interface WorkflowExecutionData {
    workflowId: string;
    initialData?: Record<string, unknown>;
    triggerNodeId?: string;
    triggerType?: NodeType;
    [key: string]: unknown;
}

export const sendWorkflowExecution = (data: WorkflowExecutionData) => {
    return inngest.send({
        name: "workflows/execute.workflow",
        data,
        id: createId(),
    });
};
