import { Connection, Node } from "@/generated/prisma"
import toposort from "toposort"

export const topologicalSort = (
    nodes: Node[],
    connections: Connection[]
): Node[] => {
    // if no connection, return node as-is (they're all independent) 
    if(connections.length === 0){
        return nodes;
    }

    // create edge array for toposort
    const edges: [string, string][] = connections.map((con)=>[
        con.fromNodeId,
        con.toNodeId
    ])

    // add node with no connections as self-edges to ensure they're included.
    const connectedNodeIds = new Set<string>();
    for(const con of connections){
        connectedNodeIds.add(con.fromNodeId);
        connectedNodeIds.add(con.toNodeId);
    }
    for(const node of nodes){
        if(!connectedNodeIds.has(node.id)){
            edges.push([node.id,node.id])
        }
    }

    // perform topological sort
    let sortedNodeIds: string[]
    try {
        sortedNodeIds = toposort(edges);
        // Remove duplicate (from self-edges)
        sortedNodeIds = [...new Set(sortedNodeIds)]; 
    } catch (error) {
        if(error instanceof Error && error.message.includes("Cyclic")){
            throw new Error("Workflow contains cycle.")
        }
        throw error;
    }

    //map the sorted id back to the node object
    const nodeMap = new Map(nodes.map((n)=>[n.id,n]));
    return sortedNodeIds.map((id)=> nodeMap.get(id)!).filter(Boolean)
}