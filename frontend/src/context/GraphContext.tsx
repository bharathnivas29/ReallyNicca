import React, { createContext, useState } from "react";

interface Node {
  id: number;
  label: string;
  type: string;
}

interface Edge {
  from: number;
  to: number;
  label: string;
  source?: string;
  weight?: number;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  metadata?: {
    total_entities: number;
    total_relationships: number;
    dependency_edges: number;
    pattern_edges: number;
    semantic_edges: number;
  };
}

interface GraphContextType {
  graph: GraphData | null;
  setGraph: (graph: GraphData | null) => void;
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

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [graph, setGraph] = useState<GraphData | null>(null);

  const addNode = (node: Node) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: [...graph.nodes, node],
      metadata: graph.metadata ? {
        ...graph.metadata,
        total_entities: graph.metadata.total_entities + 1
      } : undefined
    });
  };

  const updateNode = (id: number, updates: Partial<Node>) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
    });
  };

  const deleteNode = (id: number) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.filter(n => n.id !== id),
      edges: graph.edges.filter(e => e.from !== id && e.to !== id), // Remove connected edges
      metadata: graph.metadata ? {
        ...graph.metadata,
        total_entities: graph.metadata.total_entities - 1
      } : undefined
    });
  };

  const addEdge = (edge: Edge) => {
    if (!graph) return;
    setGraph({
      ...graph,
      edges: [...graph.edges, edge],
      metadata: graph.metadata ? {
        ...graph.metadata,
        total_relationships: graph.metadata.total_relationships + 1
      } : undefined
    });
  };

  const updateEdge = (from: number, to: number, updates: Partial<Edge>) => {
    if (!graph) return;
    setGraph({
      ...graph,
      edges: graph.edges.map(e => 
        e.from === from && e.to === to ? { ...e, ...updates } : e
      )
    });
  };

  const deleteEdge = (from: number, to: number) => {
    if (!graph) return;
    setGraph({
      ...graph,
      edges: graph.edges.filter(e => !(e.from === from && e.to === to)),
      metadata: graph.metadata ? {
        ...graph.metadata,
        total_relationships: graph.metadata.total_relationships - 1
      } : undefined
    });
  };

  return (
    <GraphContext.Provider value={{ 
      graph, 
      setGraph, 
      addNode, 
      updateNode, 
      deleteNode, 
      addEdge, 
      updateEdge, 
      deleteEdge 
    }}>
      {children}
    </GraphContext.Provider>
  );
};
