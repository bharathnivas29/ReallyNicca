import React, { createContext, useState, ReactNode } from 'react';

export interface Node {
  id: number;
  label: string;
  type: string;
  confidence?: number;        // ← ADD THIS
  reasoning?: string[];       // ← ADD THIS
  can_verify?: boolean;       // ← ADD THIS
}

export interface Edge {
  from: number;
  to: number;
  label: string;
  source?: string;
  context?: string;           // ← ADD THIS
  reason?: string;            // ← ADD THIS
  weight?: number;
}

export interface Metadata {
  total_entities: number;
  total_relationships: number;
  dependency_edges: number;
  pattern_edges: number;
  semantic_edges: number;
  average_confidence?: number;       // ← ADD THIS
  accuracy_estimate?: string;        // ← ADD THIS
  model?: string;                    // ← ADD THIS
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  metadata?: Metadata;
}

interface GraphContextType {
  graph: Graph | null;
  setGraph: (graph: Graph) => void;
  addNode: (node: Node) => void;
  updateNode: (id: number, updates: Partial<Node>) => void;
  deleteNode: (id: number) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (from: number, to: number, updates: Partial<Edge>) => void;
  deleteEdge: (from: number, to: number) => void;
}

export const GraphContext = createContext<GraphContextType>({
  graph: null,
  setGraph: () => {},
  addNode: () => {},
  updateNode: () => {},
  deleteNode: () => {},
  addEdge: () => {},
  updateEdge: () => {},
  deleteEdge: () => {},
});

export const GraphProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [graph, setGraph] = useState<Graph | null>(null);

  const addNode = (node: Node) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: [...graph.nodes, node],
    });
  };

  const updateNode = (id: number, updates: Partial<Node>) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    });
  };

  const deleteNode = (id: number) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== id),
      edges: graph.edges.filter((edge) => edge.from !== id && edge.to !== id),
    });
  };

  const addEdge = (edge: Edge) => {
    if (!graph) return;
    setGraph({
      ...graph,
      edges: [...graph.edges, edge],
    });
  };

  const updateEdge = (from: number, to: number, updates: Partial<Edge>) => {
    if (!graph) return;
    setGraph({
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.from === from && edge.to === to ? { ...edge, ...updates } : edge
      ),
    });
  };

  const deleteEdge = (from: number, to: number) => {
    if (!graph) return;
    setGraph({
      ...graph,
      edges: graph.edges.filter((edge) => !(edge.from === from && edge.to === to)),
    });
  };

  return (
    <GraphContext.Provider
      value={{
        graph,
        setGraph,
        addNode,
        updateNode,
        deleteNode,
        addEdge,
        updateEdge,
        deleteEdge,
      }}
    >
      {children}
    </GraphContext.Provider>
  );
};
