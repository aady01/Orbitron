import { NodeType } from "@/generated/prisma";

export type WorkflowContext = Record<string, unknown>;

export interface ExecutionPlanNode {
  id: string;
  type: NodeType;
}

export interface ExecutionPlanConnection {
  fromNodeId: string;
  toNodeId: string;
}

export interface ExecutionPlanStage {
  nodeIds: string[];
}

export interface ExecutionPlan {
  entryNodeId: string;
  stages: ExecutionPlanStage[];
  detachedNodeIds: string[];
}

export type ExecutionPlanErrorCode =
  | "empty_workflow"
  | "duplicate_node"
  | "unknown_connection_node"
  | "entry_not_found"
  | "entry_not_trigger"
  | "entry_has_incoming"
  | "cycle"
  | "context_conflict"
  | "missing_planned_node";

export class ExecutionPlanError extends Error {
  readonly code: ExecutionPlanErrorCode;

  constructor(code: ExecutionPlanErrorCode, message: string) {
    super(message);
    this.name = "ExecutionPlanError";
    this.code = code;
  }
}

const entryNodeTypes = new Set<NodeType>([
  NodeType.INITIAL,
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
]);

interface Graph {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  order: Map<string, number>;
}

const buildGraph = (
  nodes: ExecutionPlanNode[],
  connections: ExecutionPlanConnection[]
): Graph => {
  if (nodes.length === 0) {
    throw new ExecutionPlanError("empty_workflow", "Workflow has no nodes");
  }

  const nodeIds = new Set<string>();
  const order = new Map<string, number>();

  nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      throw new ExecutionPlanError(
        "duplicate_node",
        `Workflow contains duplicate node id: ${node.id}`
      );
    }

    nodeIds.add(node.id);
    order.set(node.id, index);
  });

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const seenEdges = new Set<string>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const connection of connections) {
    if (
      !nodeIds.has(connection.fromNodeId) ||
      !nodeIds.has(connection.toNodeId)
    ) {
      throw new ExecutionPlanError(
        "unknown_connection_node",
        `Connection references an unknown node: ${connection.fromNodeId} -> ${connection.toNodeId}`
      );
    }

    const edgeKey = `${connection.fromNodeId}\u0000${connection.toNodeId}`;

    if (seenEdges.has(edgeKey)) {
      continue;
    }

    seenEdges.add(edgeKey);
    outgoing.get(connection.fromNodeId)!.push(connection.toNodeId);
    incoming.get(connection.toNodeId)!.push(connection.fromNodeId);
  }

  return { outgoing, incoming, order };
};

export const resolveEntryNode = (
  nodes: ExecutionPlanNode[],
  options: {
    entryNodeId?: string;
    entryNodeType?: NodeType;
  } = {}
): ExecutionPlanNode => {
  if (nodes.length === 0) {
    throw new ExecutionPlanError("empty_workflow", "Workflow has no nodes");
  }

  if (options.entryNodeId) {
    const entryNode = nodes.find((node) => node.id === options.entryNodeId);

    if (!entryNode) {
      throw new ExecutionPlanError(
        "entry_not_found",
        `Trigger node not found: ${options.entryNodeId}`
      );
    }

    if (!entryNodeTypes.has(entryNode.type)) {
      throw new ExecutionPlanError(
        "entry_not_trigger",
        `Node ${entryNode.id} is not a trigger`
      );
    }

    return entryNode;
  }

  if (options.entryNodeType) {
    if (!entryNodeTypes.has(options.entryNodeType)) {
      throw new ExecutionPlanError(
        "entry_not_trigger",
        `Node type ${options.entryNodeType} is not a trigger`
      );
    }

    const entryNode = nodes.find((node) => node.type === options.entryNodeType);

    if (!entryNode) {
      throw new ExecutionPlanError(
        "entry_not_found",
        `No trigger of type ${options.entryNodeType} was found`
      );
    }

    return entryNode;
  }

  const fallbackEntry =
    nodes.find((node) => entryNodeTypes.has(node.type)) ?? nodes[0];

  return fallbackEntry;
};

const buildComponentStages = (
  componentNodeIds: string[],
  graph: Graph
): string[][] => {
  const componentSet = new Set(componentNodeIds);
  const indegree = new Map<string, number>();

  for (const nodeId of componentNodeIds) {
    const incoming = graph.incoming.get(nodeId) ?? [];
    indegree.set(
      nodeId,
      incoming.filter((fromNodeId) => componentSet.has(fromNodeId)).length
    );
  }

  let ready = componentNodeIds
    .filter((nodeId) => indegree.get(nodeId) === 0)
    .sort((a, b) => graph.order.get(a)! - graph.order.get(b)!);

  const stages: string[][] = [];
  let processed = 0;

  while (ready.length > 0) {
    const stage = ready;
    stages.push(stage);
    processed += stage.length;

    const nextReady: string[] = [];

    for (const nodeId of stage) {
      for (const toNodeId of graph.outgoing.get(nodeId) ?? []) {
        if (!componentSet.has(toNodeId)) {
          continue;
        }

        const nextIndegree = (indegree.get(toNodeId) ?? 0) - 1;
        indegree.set(toNodeId, nextIndegree);

        if (nextIndegree === 0) {
          nextReady.push(toNodeId);
        }
      }
    }

    ready = nextReady.sort(
      (a, b) => graph.order.get(a)! - graph.order.get(b)!
    );
  }

  if (processed !== componentNodeIds.length) {
    const remaining = componentNodeIds
      .filter((nodeId) => (indegree.get(nodeId) ?? 0) > 0)
      .sort((a, b) => graph.order.get(a)! - graph.order.get(b)!);

    throw new ExecutionPlanError(
      "cycle",
      `Workflow contains a cycle involving: ${remaining.join(", ")}`
    );
  }

  return stages;
};

export const createExecutionPlan = (input: {
  nodes: ExecutionPlanNode[];
  connections: ExecutionPlanConnection[];
  entryNodeId?: string;
  entryNodeType?: NodeType;
}): ExecutionPlan => {
  const graph = buildGraph(input.nodes, input.connections);
  const entryNode = resolveEntryNode(input.nodes, {
    entryNodeId: input.entryNodeId,
    entryNodeType: input.entryNodeType,
  });

  if ((graph.incoming.get(entryNode.id) ?? []).length > 0) {
    throw new ExecutionPlanError(
      "entry_has_incoming",
      `Trigger node ${entryNode.id} cannot have incoming connections`
    );
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of input.nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    const componentNodeIds: string[] = [];
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      componentNodeIds.push(nodeId);

      const neighbors = [
        ...(graph.outgoing.get(nodeId) ?? []),
        ...(graph.incoming.get(nodeId) ?? []),
      ];

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    components.push(componentNodeIds);
  }

  const entryComponent = components.find((componentNodeIds) =>
    componentNodeIds.includes(entryNode.id)
  )!;
  const otherComponents = components
    .filter((componentNodeIds) => componentNodeIds !== entryComponent)
    .sort((a, b) => {
      const firstA = Math.min(...a.map((nodeId) => graph.order.get(nodeId)!));
      const firstB = Math.min(...b.map((nodeId) => graph.order.get(nodeId)!));
      return firstA - firstB;
    });

  const orderedComponents = [entryComponent, ...otherComponents];
  const stages = orderedComponents.flatMap((componentNodeIds) =>
    buildComponentStages(componentNodeIds, graph).map((nodeIds) => ({
      nodeIds,
    }))
  );

  const entryComponentSet = new Set(entryComponent);
  const detachedNodeIds = input.nodes
    .filter((node) => !entryComponentSet.has(node.id))
    .map((node) => node.id);

  return {
    entryNodeId: entryNode.id,
    stages,
    detachedNodeIds,
  };
};

export const mergeStageContexts = (
  baseContext: WorkflowContext,
  stageResults: WorkflowContext[]
): WorkflowContext => {
  const merged: WorkflowContext = { ...baseContext };
  const changedBy = new Map<string, number>();

  stageResults.forEach((result, index) => {
    for (const [key, value] of Object.entries(result)) {
      if (Object.is(value, baseContext[key])) {
        continue;
      }

      const previousIndex = changedBy.get(key);

      if (
        previousIndex !== undefined &&
        previousIndex !== index &&
        !Object.is(merged[key], value)
      ) {
        throw new ExecutionPlanError(
          "context_conflict",
          `Sibling nodes produced different values for context key "${key}"`
        );
      }

      changedBy.set(key, index);
      merged[key] = value;
    }
  });

  return merged;
};

export const runExecutionPlan = async <TNode extends ExecutionPlanNode>(input: {
  plan: ExecutionPlan;
  nodes: TNode[];
  initialContext: WorkflowContext;
  execute: (node: TNode, context: WorkflowContext) => Promise<WorkflowContext>;
}): Promise<WorkflowContext> => {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  let context = input.initialContext;

  for (const stage of input.plan.stages) {
    const stageContext = context;
    const stageResults: WorkflowContext[] = [];

    for (const nodeId of stage.nodeIds) {
      const node = nodeById.get(nodeId);

      if (!node) {
        throw new ExecutionPlanError(
          "missing_planned_node",
          `Planned node not found: ${nodeId}`
        );
      }

      stageResults.push(await input.execute(node, stageContext));
    }

    context = mergeStageContexts(stageContext, stageResults);
  }

  return context;
};
