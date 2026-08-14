"use client"

import { createId } from "@paralleldrive/cuid2"
import { useReactFlow } from "@xyflow/react"
import { GlobeIcon, MousePointer2Icon } from "lucide-react"
import { useCallback } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"

import { NodeType } from "@/generated/prisma"
import { Separator } from "./ui/separator"
import { toast } from "sonner"


export type NodeTypeOptions = {
    type: NodeType;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }> | string;
}

const triggerNodes: NodeTypeOptions[] = [
    {
        type: NodeType.MANUAL_TRIGGER,
        label: "Trigger Manually",
        description: "Runs the flow quickly by clicking a button. Good for getting started quickly.",
        icon: MousePointer2Icon
    },
    {
        type: NodeType.GOOGLE_FORM_TRIGGER,
        label: "Google Form",
        description: "Runs the flow when a Google Form is submitted.",
        icon: "/logos/googleform.svg"
    },
    {
        type: NodeType.STRIPE_TRIGGER,
        label: "Stripe Event",
        description: "Runs the flow when a Stripe Event is captured.",
        icon: "/logos/stripe.svg"
    },
]
const executionNodes: NodeTypeOptions[] = [
    {
        type: NodeType.HTTP_REQUEST,
        label: "HTTP Request",
        description: "Makes an HTTP Request.",
        icon: GlobeIcon
    },
    {
        type: NodeType.GEMINI,
        label: "Gemini",
        description: "Uses Google Gemini to generate text",
        icon: "/logos/gemini.svg"
    },
    {
        type: NodeType.OPENAI,
        label: "OpenAI",
        description: "Uses OpenAI to generate text",
        icon: "/logos/openai.svg"
    },
    {
        type: NodeType.ANTHROPIC,
        label: "Anthropic",
        description: "Uses Anthropic to generate text",
        icon: "/logos/anthropic.svg"
    },
]

interface NodeSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export function NodeSelector({ open, onOpenChange, children }: NodeSelectorProps) {

    const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();

    const handleNodeSelect = useCallback((selection: NodeTypeOptions) => {
        if (selection.type === NodeType.MANUAL_TRIGGER) {
            const nodes = getNodes();
            const hasManualTrigger = nodes.some(
                (node) => node.type === NodeType.MANUAL_TRIGGER
            )

            if (hasManualTrigger) {
                toast.error("Only manual trigger is allowed per workflow");
                return;
            }

        }
        setNodes((nodes) => {
            const hasInitialTrigger = nodes.some(
                (node) => node.type === NodeType.INITIAL
            )

            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            const flowPosition = screenToFlowPosition({
                x: centerX + (Math.random() - 0.5) * 200,
                y: centerY + (Math.random() - 0.5) * 200,
            })

            const newNode = {
                id: createId(),
                data: {},
                position: flowPosition,
                type: selection.type
            }
            if (hasInitialTrigger) {
                return [newNode];
            }
            return [...nodes, newNode];
        })

        onOpenChange(false);
    }, [
        setNodes,
        getNodes,
        onOpenChange,
        screenToFlowPosition
    ])
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>{children}</SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>What trigger this workflow?</SheetTitle>
                    <SheetDescription>
                        A trigger is a step that start your workflow.
                    </SheetDescription>
                </SheetHeader>
                <div>
                    {triggerNodes.map((nodeType) => {
                        const Icon = nodeType.icon;
                        return (
                            <div
                                key={nodeType.type}
                                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                                onClick={() => { handleNodeSelect(nodeType) }}
                            >
                                <div className="flex justify-start gap-6 w-full overflow-hidden">
                                    {typeof Icon === "string" ? (
                                        <img
                                            src={Icon}
                                            alt={nodeType.label}
                                            className="size-5 object-contain rounded-sm"
                                        />
                                    ) : (
                                        <Icon className="size-5" />
                                    )}
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-medium text-sm">
                                            {nodeType.label}
                                        </span>
                                        <span className="text-xs">
                                            {nodeType.description}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <Separator />
                <div>
                    {executionNodes.map((nodeType) => {
                        const Icon = nodeType.icon;
                        return (
                            <div
                                key={nodeType.type}
                                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                                onClick={() => { handleNodeSelect(nodeType) }}
                            >
                                <div className="flex justify-start gap-6 w-full overflow-hidden">
                                    {typeof Icon === "string" ? (
                                        <img
                                            src={Icon}
                                            alt={nodeType.label}
                                            className="size-5 object-contain rounded-sm"
                                        />
                                    ) : (
                                        <Icon className="size-5" />
                                    )}
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-medium text-sm">
                                            {nodeType.label}
                                        </span>
                                        <span className="text-xs">
                                            {nodeType.description}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </SheetContent>
        </Sheet>
    )
}