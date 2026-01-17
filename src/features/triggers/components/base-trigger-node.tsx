"use client"

import { type NodeProps, Position } from "@xyflow/react"
import { Icon, type LucideIcon } from "lucide-react"
import Image from "next/image"
import { memo, type ReactNode, useCallback } from "react"
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node"
import { BaseHandle } from "@/components/react-flow/base-handle"
import { WorkflowNode } from "@/components/workflow-node"

interface BaseTriggerNodeProps extends NodeProps {
    icon: LucideIcon | string;
    name: string;
    description?: string;
    children?: ReactNode;
    // status?:NodeStatus;
    onSetting?: () => void
    onDoubleClick?: () => void
}

export const BaseTriggerNode = memo(
    ({
        icon: Icon,
        name,
        description,
        children,
        onDoubleClick,
        onSetting
    }: BaseTriggerNodeProps) => {

        const handleDelete = () => { }
        return (
            <WorkflowNode
                name={name}
                description={description}
                onDelete={handleDelete}
                onSettings={onSetting}
                showToolBar
            >
                <BaseNode onDoubleClick={onDoubleClick}
                    className="rounded-l-2xl realtive group"
                >
                    <BaseNodeContent>
                        {typeof Icon === "string" ? (
                            <Image src={Icon} alt={name} width={16} height={16} />
                        ) : (
                            <Icon className="size-4 text-muted-foreground" />
                        )}
                        {children}
                        <BaseHandle
                            id="source-1"
                            type="source"
                            position={Position.Right}
                        />
                    </BaseNodeContent>
                </BaseNode>
            </WorkflowNode>
        )
    },
)

BaseTriggerNode.displayName = "BaseTriggerNode"