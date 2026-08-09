import { InitialNode } from "@/components/initial-nodes";
import { HttpRequestNode } from "@/features/executions/components/http-request/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
import { GoogleFormTriggerNode } from "@/features/triggers/components/google-form-trigger/node";
import { StripeTriggerNode } from "@/features/triggers/components/stripe-trigger/node";
import { NodeType } from "@/generated/prisma";
import type { NodeTypes } from "@xyflow/react";

export const nodeComponents= {
    [NodeType.INITIAL]:InitialNode,
    [NodeType.HTTP_REQUEST]:HttpRequestNode,
    [NodeType.MANUAL_TRIGGER]:ManualTriggerNode,
    [NodeType.GOOGLE_FORM_TRIGGER]:GoogleFormTriggerNode,
    [NodeType.STRIPE_TRIGGER]:StripeTriggerNode,
} as const satisfies NodeTypes