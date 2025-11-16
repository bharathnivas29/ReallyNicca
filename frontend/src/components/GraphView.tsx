import React, { useContext, useEffect, useRef, useState } from "react";
import { GraphContext } from "../context/GraphContext";
import { Network, DataSet } from "vis-network/standalone/esm/vis-network";

interface SelectedNode {
  id: number;
  label: string;
  type: string;
  connections: number;
  confidence?: number;
  reasoning?: string[];
  can_verify?: boolean;
}

interface SelectedEdge {
  from: number;
  to: number;
  label: string;
  source?: string;
  context?: string;
  reason?: string;
}

interface RelationshipDetail {
  toNode: { id: number; label: string; type: string };
  relationship: string;
  reason: string;
  context: string;
}

type LayoutType = "force" | "hierarchical-vertical" | "hierarchical-horizontal";

const GraphView: React.FC = () => {
  const {
    graph,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
  } = useContext(GraphContext);
  const container = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  
  // NEW: Store dataset refs for reset functionality
  const nodesDatasetRef = useRef<DataSet<any> | null>(null);
  const edgesDatasetRef = useRef<DataSet<any> | null>(null);

  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutType, setLayoutType] = useState<LayoutType>("force");
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [edgeFilter, setEdgeFilter] = useState<string>("all");

  const [editMode, setEditMode] = useState(false);
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [isEditingEdge, setIsEditingEdge] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showAddEdgeModal, setShowAddEdgeModal] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [nodeRelationships, setNodeRelationships] = useState<RelationshipDetail[]>([]);

  const [editNodeForm, setEditNodeForm] = useState({ label: "", type: "" });
  const [editEdgeForm, setEditEdgeForm] = useState({ label: "" });
  const [newNodeForm, setNewNodeForm] = useState({ label: "", type: "PERSON" });
  const [newEdgeForm, setNewEdgeForm] = useState({ from: 0, to: 0, label: "" });

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Store original styles for blur effect
  const [originalNodesStyle, setOriginalNodesStyle] = useState<any>(null);
  const [originalEdgesStyle, setOriginalEdgesStyle] = useState<any>(null);

  useEffect(() => {
    if (graph && container.current && graph.nodes.length > 0) {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }

      const nodeColors: Record<string, string> = {
        PERSON: "#ef4444",
        ORG: "#3b82f6",
        GPE: "#10b981",
        LOC: "#10b981",
        DATE: "#f59e0b",
        WORK_OF_ART: "#ec4899",
        EVENT: "#8b5cf6",
        PRODUCT: "#14b8a6",
        MONEY: "#84cc16",
        THEME: "#a855f7",
      };

      const nodes = new DataSet(
        graph.nodes.map((node) => {
          const confidence = (node as any).confidence || 0.7;
          const borderColor =
            confidence >= 0.85
              ? "#10b981"
              : confidence >= 0.7
              ? "#f59e0b"
              : "#ef4444";

          return {
            id: node.id,
            label: node.label,
            title: `${node.type}: ${node.label}\nConfidence: ${(
              confidence * 100
            ).toFixed(0)}%`,
            shape: "dot",
            size: 20,
            color: {
              background: nodeColors[node.type] || "#6b7280",
              border: borderColor,
              highlight: {
                background: nodeColors[node.type] || "#6b7280",
                border: "#000000",
              },
            },
            font: { color: "#ffffff", size: 12 },
            borderWidth: 3,
          };
        })
      );

      const getFilteredEdges = () => {
        let filtered = graph.edges;
        if (edgeFilter !== "all") {
          filtered = filtered.filter((e) => (e as any).source === edgeFilter);
        }
        if (!showAllEdges && filtered.length > 50) {
          const priorityMap: Record<string, number> = {
            dependency: 3,
            pattern: 2,
            semantic: 1,
          };
          filtered = filtered
            .sort(
              (a, b) =>
                (priorityMap[(b as any).source || ""] || 0) -
                (priorityMap[(a as any).source || ""] || 0)
            )
            .slice(0, 50);
        }
        return filtered;
      };

      const edges = new DataSet(
        getFilteredEdges().map((edge, idx) => {
          const edgeAny = edge as any;
          return {
            id: `edge-${idx}`,
            from: edge.from,
            to: edge.to,
            label: showAllEdges ? "" : edge.label,
            title: `${edge.label} (${edgeAny.source || "unknown"})\n${edgeAny.reason || ""}`,
            arrows: "to",
            color: {
              color:
                edgeAny.source === "dependency"
                  ? "#3b82f6"
                  : edgeAny.source === "pattern"
                  ? "#10b981"
                  : edgeAny.source === "semantic"
                  ? "#f59e0b"
                  : edgeAny.source === "topic_modeling"
                  ? "#a855f7"
                  : "#6b7280",
              opacity: 0.3,
              highlight: "#000000",
            },
            font: { size: 10, align: "middle" },
            width: 1,
            smooth: {
              enabled: true,
              type: "cubicBezier",
              roundness: 0.6,
            },
          };
        })
      );

      const data = { nodes, edges };

      // Store refs for later use
      nodesDatasetRef.current = nodes;
      edgesDatasetRef.current = edges;

      // Store original styles
      setOriginalNodesStyle(nodes.get());
      setOriginalEdgesStyle(edges.get());

      const getLayoutConfig = () => {
        switch (layoutType) {
          case "hierarchical-vertical":
            return {
              hierarchical: {
                enabled: true,
                direction: "UD",
                sortMethod: "directed",
                nodeSpacing: 250,
                levelSeparation: 200,
                treeSpacing: 250,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
              },
            };
          case "hierarchical-horizontal":
            return {
              hierarchical: {
                enabled: true,
                direction: "LR",
                sortMethod: "directed",
                nodeSpacing: 200,
                levelSeparation: 250,
                treeSpacing: 200,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
              },
            };
          case "force":
          default:
            return {
              randomSeed: 42,
              improvedLayout: true,
              hierarchical: false,
            };
        }
      };

      const options = {
        nodes: {
          borderWidth: 2,
          borderWidthSelected: 4,
          font: { color: "#ffffff", size: 12 },
        },
        edges: {
          smooth: {
            enabled: true,
            type: "continuous",
            roundness: 0.5,
          },
        },
        physics: {
          enabled: layoutType === "force",
          stabilization: {
            enabled: true,
            iterations: 400,
            updateInterval: 50,
          },
          barnesHut: {
            gravitationalConstant: -20000,
            centralGravity: 0.3,
            springLength: 250,
            springConstant: 0.02,
            damping: 0.5,
            avoidOverlap: 1,
          },
        },
        interaction: {
          dragNodes: true,
          dragView: true,
          zoomView: true,
          hover: true,
          hoverConnectedEdges: true,
          tooltipDelay: 100,
          navigationButtons: false,
        },
        layout: getLayoutConfig(),
      };

      networkRef.current = new Network(container.current, data, options);

      // NODE CLICK: Show relationships panel
      networkRef.current.on("selectNode", (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = graph.nodes.find((n) => n.id === nodeId);
          if (node) {
            const connections = graph.edges.filter(
              (e) => e.from === nodeId || e.to === nodeId
            ).length;

            setSelectedNode({
              id: node.id,
              label: node.label,
              type: node.type,
              connections,
              confidence: (node as any).confidence,
              reasoning: (node as any).reasoning,
              can_verify: (node as any).can_verify,
            });

            // Build relationships details
            const relationships: RelationshipDetail[] = [];
            graph.edges.forEach((edge) => {
              const edgeAny = edge as any;
              if (edge.from === nodeId) {
                const toNode = graph.nodes.find((n) => n.id === edge.to);
                if (toNode) {
                  relationships.push({
                    toNode: { id: toNode.id, label: toNode.label, type: toNode.type },
                    relationship: edge.label,
                    reason: edgeAny.reason || "Pattern detected in text",
                    context: edgeAny.context || "",
                  });
                }
              }
              if (edge.to === nodeId) {
                const fromNode = graph.nodes.find((n) => n.id === edge.from);
                if (fromNode) {
                  relationships.push({
                    toNode: {
                      id: fromNode.id,
                      label: fromNode.label,
                      type: fromNode.type,
                    },
                    relationship: `← ${edge.label}`,
                    reason: edgeAny.reason || "Pattern detected in text",
                    context: edgeAny.context || "",
                  });
                }
              }
            });

            setNodeRelationships(relationships);
            setShowRelationshipPanel(true);
            setEditNodeForm({ label: node.label, type: node.type });
            setSelectedEdge(null);
            setIsEditingEdge(false);
            setShowDetailsPanel(true);
            setVerificationResult(null);
          }
        }
      });

      // EDGE CLICK: Highlight edge + connected nodes, blur rest
      networkRef.current.on("selectEdge", (params) => {
        if (params.edges.length > 0) {
          const edgeId = params.edges[0];
          const edgeIndex = parseInt(edgeId.toString().replace("edge-", ""));
          const edge = getFilteredEdges()[edgeIndex];

          if (edge && networkRef.current) {
            const edgeAny = edge as any;
            setSelectedEdge({
              from: edge.from,
              to: edge.to,
              label: edge.label,
              source: edgeAny.source,
              context: edgeAny.context,
              reason: edgeAny.reason,
            });
            setEditEdgeForm({ label: edge.label });
            setSelectedNode(null);
            setIsEditingNode(false);
            setShowDetailsPanel(true);
            setShowRelationshipPanel(false);

            // Highlight only this edge and connected nodes
            const connectedNodes = [edge.from, edge.to];

            // Blur all nodes except connected ones (use color instead of opacity)
            nodes.forEach((node: any) => {
              if (connectedNodes.includes(node.id)) {
                nodes.update({
                  id: node.id,
                  color: {
                    background: node.color.background,
                    border: node.color.border,
                  },
                  font: { color: "#ffffff", size: 12 },
                });
              } else {
                nodes.update({
                  id: node.id,
                  color: {
                    background: "#3a3a3a",
                    border: "#555555",
                  },
                  font: { color: "#666666", size: 12 },
                });
              }
            });

            // Highlight only selected edge, blur others
            edges.forEach((e: any) => {
              if (e.id === edgeId) {
                edges.update({
                  id: e.id,
                  width: 3,
                  color: { color: "#10b981", opacity: 1 },
                });
              } else {
                edges.update({
                  id: e.id,
                  width: 1,
                  color: { ...e.color, opacity: 0.1 },
                });
              }
            });
          }
        }
      });

      // DESELECT: Reset blur
      networkRef.current.on("deselectNode", () => {
        setSelectedNode(null);
        setIsEditingNode(false);
        setShowRelationshipPanel(false);
        resetNodeEdgeStyles(nodes, edges);
      });

      networkRef.current.on("deselectEdge", () => {
        setSelectedEdge(null);
        setIsEditingEdge(false);
        resetNodeEdgeStyles(nodes, edges);
      });
    }
  }, [graph, layoutType, showAllEdges, edgeFilter]);

  const resetNodeEdgeStyles = (nodes: any, edges: any) => {
    // Reset all nodes to original style
    if (originalNodesStyle) {
      originalNodesStyle.forEach((node: any) => {
        nodes.update({
          id: node.id,
          color: node.color,
          font: { color: "#ffffff", size: 12 },
        });
      });
    }

    // Reset all edges to original style
    if (originalEdgesStyle) {
      originalEdgesStyle.forEach((edge: any) => {
        edges.update({
          id: edge.id,
          width: edge.width || 1,
          color: edge.color,
        });
      });
    }
  };

  const handleVerifyEntity = async () => {
    if (!selectedNode) return;

    setIsVerifying(true);
    try {
      const response = await fetch(`http://localhost:5000/api/verify-entity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: selectedNode.label }),
      });

      const result = await response.json();
      setVerificationResult(result);

      if (result.type && result.confidence > 0.9) {
        // Update node with verified type
        updateNode(selectedNode.id, { type: result.type });
      }
    } catch (error) {
      console.error("Verification failed:", error);
      setVerificationResult({ error: "Failed to verify entity" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (networkRef.current && graph) {
      const matchingNodes = graph.nodes.filter((node) =>
        node.label.toLowerCase().includes(query.toLowerCase())
      );
      if (matchingNodes.length > 0) {
        networkRef.current.selectNodes(matchingNodes.map((n) => n.id));
        networkRef.current.focus(matchingNodes[0].id, {
          scale: 1.5,
          animation: true,
        });
      }
    }
  };

  const handleZoomIn = () =>
    networkRef.current?.moveTo({ scale: networkRef.current.getScale() * 1.2 });
  const handleZoomOut = () =>
    networkRef.current?.moveTo({ scale: networkRef.current.getScale() * 0.8 });
  const handleResetView = () => {
    networkRef.current?.fit({ animation: true });
    // Use stored refs instead of networkRef.current.body
    if (nodesDatasetRef.current && edgesDatasetRef.current) {
      resetNodeEdgeStyles(nodesDatasetRef.current, edgesDatasetRef.current);
    }
  };

  const handleSaveNodeEdit = () => {
    if (selectedNode) {
      updateNode(selectedNode.id, editNodeForm);
      setIsEditingNode(false);
    }
  };

  const handleDeleteNode = () => {
    if (
      selectedNode &&
      window.confirm(`Delete node "${selectedNode.label}"?`)
    ) {
      deleteNode(selectedNode.id);
      setSelectedNode(null);
    }
  };

  const handleSaveEdgeEdit = () => {
    if (selectedEdge) {
      updateEdge(selectedEdge.from, selectedEdge.to, editEdgeForm);
      setIsEditingEdge(false);
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge && window.confirm("Delete this relationship?")) {
      deleteEdge(selectedEdge.from, selectedEdge.to);
      setSelectedEdge(null);
    }
  };

  const handleAddNode = () => {
    if (newNodeForm.label.trim() && graph) {
      const newId = Math.max(...graph.nodes.map((n) => n.id), 0) + 1;
      addNode({
        id: newId,
        label: newNodeForm.label,
        type: newNodeForm.type,
      });
      setNewNodeForm({ label: "", type: "PERSON" });
      setShowAddNodeModal(false);
    }
  };

  const handleAddEdge = () => {
    if (newEdgeForm.from && newEdgeForm.to && newEdgeForm.label.trim()) {
      addEdge({
        from: newEdgeForm.from,
        to: newEdgeForm.to,
        label: newEdgeForm.label,
        source: "manual",
      });
      setNewEdgeForm({ from: 0, to: 0, label: "" });
      setShowAddEdgeModal(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#0a0a0a]">
      {/* Top Controls Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-[#0f0f0f] border-b border-gray-800 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Title + Stats */}
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-emerald-400">
              Knowledge Graph
            </h2>
            {graph?.metadata && (
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>📊 {graph.metadata.total_entities} entities</span>
                <span>🔗 {graph.metadata.total_relationships} relationships</span>
                <span className="text-emerald-400">
                  ✓ {(graph.metadata as any).accuracy_estimate || "85%"} accuracy
                </span>
              </div>
            )}
          </div>

          {/* Right: Edit Mode */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              editMode
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-emerald-500 hover:text-black"
            }`}
          >
            {editMode ? "✏️ Edit Mode ON" : "Edit Mode"}
          </button>
        </div>

        {/* Controls Row */}
        <div className="mt-4 flex gap-2 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
          />

          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value as LayoutType)}
            className="px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="force">Force-Directed</option>
            <option value="hierarchical-vertical">
              Hierarchical (Vertical)
            </option>
            <option value="hierarchical-horizontal">
              Hierarchical (Horizontal)
            </option>
          </select>

          <select
            value={edgeFilter}
            onChange={(e) => setEdgeFilter(e.target.value)}
            className="px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Edges</option>
            <option value="dependency">Syntax-Based</option>
            <option value="pattern">Pattern-Based</option>
            <option value="semantic">AI Semantic</option>
            <option value="topic_modeling">Topics</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
            <input
              type="checkbox"
              checked={showAllEdges}
              onChange={(e) => setShowAllEdges(e.target.checked)}
              className="accent-emerald-500"
            />
            <span className="text-sm text-gray-300">Show All</span>
          </label>

          <button
            onClick={handleZoomIn}
            className="px-3 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="px-3 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold"
          >
            -
          </button>
          <button
            onClick={handleResetView}
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>

          {editMode && (
            <>
              <button
                onClick={() => setShowAddNodeModal(true)}
                className="px-3 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold"
              >
                + Add Node
              </button>
              <button
                onClick={() => setShowAddEdgeModal(true)}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-semibold"
              >
                + Add Edge
              </button>
            </>
          )}
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="absolute inset-0 pt-40 pb-0">
        <div ref={container} className="w-full h-full bg-[#0f0f0f]"></div>
      </div>

      {/* Floating Details Panel (Right Side) */}
      {showDetailsPanel && (selectedNode || selectedEdge) && (
        <div className="absolute top-44 right-4 w-96 bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 z-30 shadow-2xl max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-emerald-400">Details</h3>
            <button
              onClick={() => setShowDetailsPanel(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {selectedNode && (
            <div className="bg-[#0a0a0a] border border-emerald-500 p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-emerald-400">Node Details</h4>

              {!isEditingNode ? (
                <>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-300">
                      <strong className="text-gray-400">Label:</strong>{" "}
                      {selectedNode.label}
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-gray-400">Type:</strong>{" "}
                      {selectedNode.type}
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-gray-400">Connections:</strong>{" "}
                      {selectedNode.connections}
                    </p>

                    {selectedNode.confidence && (
                      <div className="mt-2">
                        <p className="text-gray-400 text-xs mb-1">
                          Confidence:
                        </p>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              selectedNode.confidence >= 0.85
                                ? "bg-emerald-500"
                                : selectedNode.confidence >= 0.7
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${selectedNode.confidence * 100}%`,
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {(selectedNode.confidence * 100).toFixed(0)}% -{" "}
                          {selectedNode.confidence >= 0.85
                            ? "High"
                            : selectedNode.confidence >= 0.7
                            ? "Medium"
                            : "Low"}
                        </p>
                      </div>
                    )}

                    {selectedNode.reasoning &&
                      selectedNode.reasoning.length > 0 && (
                        <div className="mt-3 p-2 bg-gray-900 rounded text-xs">
                          <p className="text-gray-400 font-semibold mb-1">
                            Classification Reasoning:
                          </p>
                          {selectedNode.reasoning.map((reason, idx) => (
                            <p key={idx} className="text-gray-300 mb-1">
                              • {reason}
                            </p>
                          ))}
                        </div>
                      )}

                    {selectedNode.can_verify && (
                      <button
                        onClick={handleVerifyEntity}
                        disabled={isVerifying}
                        className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors font-semibold disabled:opacity-50"
                      >
                        {isVerifying
                          ? "Verifying..."
                          : "🔍 Verify with WikiData"}
                      </button>
                    )}

                    {verificationResult && (
                      <div
                        className={`mt-2 p-2 rounded text-xs ${
                          verificationResult.error
                            ? "bg-red-900 text-red-200"
                            : "bg-emerald-900 text-emerald-200"
                        }`}
                      >
                        {verificationResult.error ? (
                          <p>❌ {verificationResult.error}</p>
                        ) : verificationResult.type ? (
                          <>
                            <p className="font-semibold">
                              ✓ WikiData Verification:
                            </p>
                            <p>Type: {verificationResult.type}</p>
                            <p>
                              Confidence:{" "}
                              {(verificationResult.confidence * 100).toFixed(0)}
                              %
                            </p>
                            <p className="mt-1 text-emerald-300">
                              {verificationResult.reason}
                            </p>
                          </>
                        ) : (
                          <p>⚠️ Not found in WikiData</p>
                        )}
                      </div>
                    )}
                  </div>

                  {editMode && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setIsEditingNode(true)}
                        className="flex-1 px-3 py-2 bg-emerald-500 text-black rounded-lg text-sm hover:bg-emerald-400 transition-colors font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDeleteNode}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">
                      Label
                    </label>
                    <input
                      type="text"
                      value={editNodeForm.label}
                      onChange={(e) =>
                        setEditNodeForm({
                          ...editNodeForm,
                          label: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 bg-[#0a0a0a] border border-gray-800 rounded text-gray-300 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">
                      Type
                    </label>
                    <select
                      value={editNodeForm.type}
                      onChange={(e) =>
                        setEditNodeForm({
                          ...editNodeForm,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 bg-[#0a0a0a] border border-gray-800 rounded text-gray-300 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="PERSON">Person</option>
                      <option value="ORG">Organization</option>
                      <option value="GPE">Location</option>
                      <option value="DATE">Date</option>
                      <option value="EVENT">Event</option>
                      <option value="PRODUCT">Product</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNodeEdit}
                      className="flex-1 px-3 py-2 bg-emerald-500 text-black rounded-lg text-sm hover:bg-emerald-400 transition-colors font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingNode(false)}
                      className="flex-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Relationships Panel */}
              {showRelationshipPanel && nodeRelationships.length > 0 && (
                <div className="mt-4 p-3 bg-gray-900 rounded-lg">
                  <h5 className="text-sm font-semibold text-purple-400 mb-2">
                    Connected Entities ({nodeRelationships.length})
                  </h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {nodeRelationships.map((rel, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#0a0a0a] rounded text-xs border border-gray-800"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-emerald-400 font-semibold">
                            {rel.toNode.label}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {rel.toNode.type}
                          </span>
                        </div>
                        <p className="text-purple-400 font-mono text-xs mb-1">
                          {rel.relationship}
                        </p>
                        <p className="text-gray-400 text-xs mb-1">
                          <strong>Why:</strong> {rel.reason}
                        </p>
                        {rel.context && (
                          <p className="text-gray-500 text-xs italic truncate">
                            "{rel.context}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedEdge && (
            <div className="bg-[#0a0a0a] border border-purple-600 p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-purple-400">
                Relationship Details
              </h4>

              {!isEditingEdge ? (
                <>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-300">
                      <strong className="text-gray-400">From:</strong> Node{" "}
                      {selectedEdge.from}
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-gray-400">To:</strong> Node{" "}
                      {selectedEdge.to}
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-gray-400">Type:</strong>{" "}
                      {selectedEdge.label}
                    </p>
                    <p className="text-gray-300">
                      <strong className="text-gray-400">Source:</strong>{" "}
                      {selectedEdge.source || "unknown"}
                    </p>

                    {selectedEdge.reason && (
                      <div className="mt-2 p-2 bg-gray-900 rounded text-xs">
                        <p className="text-gray-400 font-semibold mb-1">
                          Why this connection:
                        </p>
                        <p className="text-gray-300">{selectedEdge.reason}</p>
                      </div>
                    )}

                    {selectedEdge.context && (
                      <div className="mt-2 p-2 bg-gray-900 rounded text-xs">
                        <p className="text-gray-400 font-semibold mb-1">
                          Context from document:
                        </p>
                        <p className="text-gray-300 italic">
                          "{selectedEdge.context}"
                        </p>
                      </div>
                    )}
                  </div>

                  {editMode && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setIsEditingEdge(true)}
                        className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-500 transition-colors font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDeleteEdge}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">
                      Relationship Label
                    </label>
                    <input
                      type="text"
                      value={editEdgeForm.label}
                      onChange={(e) =>
                        setEditEdgeForm({ label: e.target.value })
                      }
                      className="w-full px-2 py-1 bg-[#0a0a0a] border border-gray-800 rounded text-gray-300 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdgeEdit}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-500 transition-colors font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingEdge(false)}
                      className="flex-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {graph && graph.nodes.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-[#0f0f0f] border border-gray-800 rounded-lg p-3 z-20 text-xs text-gray-400">
          <strong className="text-emerald-400">Entity Types:</strong>
          <div className="mt-2 space-y-1">
            <span className="block" style={{ color: "#ef4444" }}>
              ● Person
            </span>
            <span className="block" style={{ color: "#3b82f6" }}>
              ● Organization
            </span>
            <span className="block" style={{ color: "#10b981" }}>
              ● Location
            </span>
            <span className="block" style={{ color: "#f59e0b" }}>
              ● Date
            </span>
            <span className="block" style={{ color: "#8b5cf6" }}>
              ● Event
            </span>
            <span className="block" style={{ color: "#14b8a6" }}>
              ● Product
            </span>
          </div>
          <div className="mt-3">
            <strong className="text-purple-400">Confidence:</strong>
            <div className="mt-1 space-y-1">
              <span className="block text-emerald-400">━ High (85%+)</span>
              <span className="block text-yellow-400">━ Medium (70-85%)</span>
              <span className="block text-red-400">━ Low (&lt;70%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!graph || graph.nodes.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-lg font-medium mb-2">No Graph Loaded</p>
            <p className="text-sm">
              Upload a document to generate a knowledge graph
            </p>
          </div>
        </div>
      )}

      {/* Add Node Modal */}
      {showAddNodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-emerald-400">
              Add New Node
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">
                  Label
                </label>
                <input
                  type="text"
                  value={newNodeForm.label}
                  onChange={(e) =>
                    setNewNodeForm({ ...newNodeForm, label: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter entity name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">
                  Type
                </label>
                <select
                  value={newNodeForm.type}
                  onChange={(e) =>
                    setNewNodeForm({ ...newNodeForm, type: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="PERSON">Person</option>
                  <option value="ORG">Organization</option>
                  <option value="GPE">Location</option>
                  <option value="DATE">Date</option>
                  <option value="EVENT">Event</option>
                  <option value="PRODUCT">Product</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddNode}
                  className="flex-1 px-4 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold"
                >
                  Add Node
                </button>
                <button
                  onClick={() => setShowAddNodeModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Edge Modal */}
      {showAddEdgeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-purple-400">
              Add New Relationship
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">
                  From Node ID
                </label>
                <input
                  type="number"
                  value={newEdgeForm.from || ""}
                  onChange={(e) =>
                    setNewEdgeForm({
                      ...newEdgeForm,
                      from: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Enter source node ID..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">
                  To Node ID
                </label>
                <input
                  type="number"
                  value={newEdgeForm.to || ""}
                  onChange={(e) =>
                    setNewEdgeForm({
                      ...newEdgeForm,
                      to: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Enter target node ID..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">
                  Relationship Label
                </label>
                <input
                  type="text"
                  value={newEdgeForm.label}
                  onChange={(e) =>
                    setNewEdgeForm({ ...newEdgeForm, label: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="e.g., works_at, located_in..."
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddEdge}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-semibold"
                >
                  Add Relationship
                </button>
                <button
                  onClick={() => setShowAddEdgeModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphView;
