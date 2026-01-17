import { NodeProps } from "@xyflow/react"
import { memo } from "react"
import { BaseTriggerNode } from "../base-trigger-node"
import { MousePointer2Icon } from "lucide-react"


export const ManualTriggerNode = memo((props: NodeProps) => {
    return (
        <>
            <BaseTriggerNode
                {...props}
                icon={MousePointer2Icon}
                name="When clicking 'Execute Workflow'"
            // status={nodeStatus}
            // onSetting={handleOpenSettings}
            // onDoubleClick={ handleOpenSettings}
            />
        </>
    )
})