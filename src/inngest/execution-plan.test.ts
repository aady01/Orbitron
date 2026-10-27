import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NodeType } from "@/generated/prisma";
import {
  createExecutionPlan,
  ExecutionPlanError,
  resolveEntryNode,
  runExecutionPlan,
  type ExecutionPlanNode,
  type WorkflowContext,
} from "./execution-plan";

const node = (
  id: string,
  type: NodeType = NodeType.HTTP_REQUEST
): ExecutionPlanNode => ({ id, type });

const connection = (fromNodeId: string, toNodeId: string) => ({
  fromNodeId,
  toNodeId,
});

const assertPlanError = (
  code: ExecutionPlanError["code"],
  run: () => unknown
) => {
  assert.throws(run, (error) => {
    assert.ok(error instanceof ExecutionPlanError);
    assert.equal(error.code, code);
    return true;
  });
};

describe("createExecutionPlan", () => {
  it("accepts disconnected nodes without inventing a cycle", () => {
    const nodes = [
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("a"),
      node("b"),
    ];

    const plan = createExecutionPlan({
      nodes,
      connections: [connection("trigger", "a")],
      entryNodeId: "trigger",
    });

    assert.deepEqual(
      plan.stages.map((stage) => stage.nodeIds),
      [["trigger"], ["a"], ["b"]]
    );
    assert.deepEqual(plan.detachedNodeIds, ["b"]);
  });

  it("rejects true cycles", () => {
    const nodes = [
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("a"),
      node("b"),
    ];

    assertPlanError("cycle", () =>
      createExecutionPlan({
        nodes,
        connections: [
          connection("trigger", "a"),
          connection("a", "b"),
          connection("b", "a"),
        ],
        entryNodeId: "trigger",
      })
    );
  });

  it("rejects connections that point outside the workflow", () => {
    assertPlanError("unknown_connection_node", () =>
      createExecutionPlan({
        nodes: [node("trigger", NodeType.MANUAL_TRIGGER)],
        connections: [connection("trigger", "missing")],
        entryNodeId: "trigger",
      })
    );
  });

  it("rejects incoming connections on the trigger", () => {
    const nodes = [
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("a"),
    ];

    assertPlanError("entry_has_incoming", () =>
      createExecutionPlan({
        nodes,
        connections: [connection("a", "trigger")],
        entryNodeId: "trigger",
      })
    );
  });

  it("starts from the trigger component even when it is not first", () => {
    const nodes = [
      node("detached"),
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("child"),
    ];

    const plan = createExecutionPlan({
      nodes,
      connections: [connection("trigger", "child")],
      entryNodeId: "trigger",
    });

    assert.deepEqual(
      plan.stages.map((stage) => stage.nodeIds),
      [["trigger"], ["child"], ["detached"]]
    );
  });

  it("groups fan-out into one stage and fan-in into the next", () => {
    const nodes = [
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("left"),
      node("right"),
      node("merge"),
    ];

    const plan = createExecutionPlan({
      nodes,
      connections: [
        connection("trigger", "left"),
        connection("trigger", "right"),
        connection("left", "merge"),
        connection("right", "merge"),
      ],
      entryNodeId: "trigger",
    });

    assert.deepEqual(
      plan.stages.map((stage) => stage.nodeIds),
      [["trigger"], ["left", "right"], ["merge"]]
    );
  });

  it("selects an explicit trigger by type", () => {
    const nodes = [
      node("http"),
      node("stripe", NodeType.STRIPE_TRIGGER),
      node("manual", NodeType.MANUAL_TRIGGER),
    ];

    const entryNode = resolveEntryNode(nodes, {
      entryNodeType: NodeType.MANUAL_TRIGGER,
    });

    assert.equal(entryNode.id, "manual");
  });

  it("rejects empty workflows and duplicate node ids", () => {
    assertPlanError("empty_workflow", () =>
      createExecutionPlan({ nodes: [], connections: [] })
    );
    assertPlanError("duplicate_node", () =>
      createExecutionPlan({
        nodes: [node("a"), node("a")],
        connections: [],
      })
    );
  });
});

describe("runExecutionPlan", () => {
  it("rejects sibling nodes that write different values to the same key", async () => {
    const nodes = [
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("left"),
      node("right"),
    ];
    const plan = createExecutionPlan({
      nodes,
      connections: [
        connection("trigger", "left"),
        connection("trigger", "right"),
      ],
      entryNodeId: "trigger",
    });

    await assert.rejects(
      runExecutionPlan({
        plan,
        nodes,
        initialContext: {},
        execute: async (currentNode, context) => ({
          ...context,
          shared: currentNode.id,
        }),
      }),
      (error) => {
        assert.ok(error instanceof ExecutionPlanError);
        assert.equal(error.code, "context_conflict");
        return true;
      }
    );
  });

  it("keeps sibling branches isolated and merges their results for fan-in", async () => {
    const nodes = [
      node("trigger", NodeType.MANUAL_TRIGGER),
      node("left"),
      node("right"),
      node("merge"),
    ];
    const plan = createExecutionPlan({
      nodes,
      connections: [
        connection("trigger", "left"),
        connection("trigger", "right"),
        connection("left", "merge"),
        connection("right", "merge"),
      ],
      entryNodeId: "trigger",
    });

    const contextsSeen: Record<string, WorkflowContext> = {};

    const result = await runExecutionPlan({
      plan,
      nodes,
      initialContext: { seed: true },
      execute: async (currentNode, context) => {
        contextsSeen[currentNode.id] = context;

        return {
          ...context,
          [currentNode.id]: true,
        };
      },
    });

    assert.equal(contextsSeen.left.seed, true);
    assert.equal(contextsSeen.left.trigger, true);
    assert.equal("right" in contextsSeen.left, false);
    assert.equal("merge" in contextsSeen.left, false);

    assert.equal(contextsSeen.right.seed, true);
    assert.equal(contextsSeen.right.trigger, true);
    assert.equal("left" in contextsSeen.right, false);
    assert.equal("merge" in contextsSeen.right, false);

    assert.equal(contextsSeen.merge.left, true);
    assert.equal(contextsSeen.merge.right, true);

    assert.deepEqual(result, {
      seed: true,
      trigger: true,
      left: true,
      right: true,
      merge: true,
    });
  });
});
