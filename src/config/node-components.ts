import { InitialNode } from "@/components/initial-nodes";
import { NodeType } from "@/generated/prisma";
import type { NodeTypes } from "@xyflow/react";

export const nodeComponents= {[NodeType.INITIAL]:InitialNode, } as const satisfies NodeTypes