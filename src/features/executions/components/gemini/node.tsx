"use client"
import { Node, NodeProps, useReactFlow } from "@xyflow/react"
import { memo, useState } from "react"
import { BaseExecutionNode } from "../base-execution-node"
import { GeminiDialog, GeminiFormValues } from "./dialog"
import { useNodeStatus } from "../../hooks/use-node-status"
import { GEMINI_CHANNEL_NAME } from "@/inngest/channels/constants"
import { fetchGeminiRealtimeToken } from "./actions"

type GeminiNodeData = {
  variableName?: string;
  systemPrompt?: string;
  userPrompt?: string;
}

type GeminiNodeType = Node<GeminiNodeData>;

export const GeminiNode = memo((props: NodeProps<GeminiNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const handleOpenSettings = () => setDialogOpen(true)

  const handleSubmit = (values: GeminiFormValues) => {
    setNodes((nodes) => nodes.map((node) => {
      if (node.id === props.id) {
        return {
          ...node,
          data: {
            ...node.data,
            ...values
          }
        }
      }
      return node
    }))
  }

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: GEMINI_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchGeminiRealtimeToken,
  });

  const nodeData = props.data;
  const description = nodeData?.userPrompt
    ? `gemini-2.0-flash: ${nodeData.userPrompt.slice(0, 50)}...`
    : "Not configured"

  return (
    <>
      <GeminiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/gemini.svg"
        name="Gemini"
        status={nodeStatus}
        description={description}
        onSetting={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  )
})

GeminiNode.displayName = "GeminiNode"
