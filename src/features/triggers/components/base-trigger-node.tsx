"use client"

import { type NodeProps, Position, useReactFlow } from "@xyflow/react"
import { Icon, type LucideIcon } from "lucide-react"
import Image from "next/image"
import { memo, type ReactNode, useCallback } from "react"
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node"
import { BaseHandle } from "@/components/react-flow/base-handle"
import { WorkflowNode } from "@/components/workflow-node"
import { NodeStatus, NodeStatusIndicator } from "@/components/react-flow/node-status-indicator"

interface BaseTriggerNodeProps extends NodeProps {
    icon: LucideIcon | string;
    name: string;
    description?: string;
    children?: ReactNode;
    status?: NodeStatus;
    onSetting?: () => void
    onDoubleClick?: () => void
}

export const BaseTriggerNode = memo(
    ({
        id,
        icon: Icon,
        name,
        description,
        children,
        onDoubleClick,
        status = "initial",
        onSetting
    }: BaseTriggerNodeProps) => {

        const { setNodes, setEdges } = useReactFlow();

        const handleDelete = () => {
            setNodes((currentNodes) => {
                const updatedNodes = currentNodes.filter((node) => node.id !== id);
                return updatedNodes;
            })

            setEdges((currentEdges) => {
                const updatedEdges = currentEdges.filter((edge) => edge.source !== id && edge.target !== id);
                return updatedEdges;
            })
        }
        return (
            <WorkflowNode
                name={name}
                description={description}
                onDelete={handleDelete}
                onSettings={onSetting}
                showToolBar
            >
                <NodeStatusIndicator
                    status={status}
                    variant="border"
                    className="rounded-l-2xl"
                >
                    <BaseNode onDoubleClick={onDoubleClick}
                        status={status}
                        className="rounded-l-2xl relative group"
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
                </NodeStatusIndicator>
            </WorkflowNode>
        )
    },
)

BaseTriggerNode.displayName = "BaseTriggerNode"