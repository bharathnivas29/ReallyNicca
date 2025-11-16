import React, { useContext, useEffect, useRef, useState } from "react";
import { GraphContext } from "../context/GraphContext";
import { Network, DataSet } from "vis-network/standalone/esm/vis-network";

interface SelectedNode {
  id: number;
  label: string;
  type: string;
  connections: number;
}

interface SelectedEdge {
  from: number;
  to: number;
  label: string;
  source?: string;
}

type LayoutType = "force" | "hierarchical-vertical" | "hierarchical-horizontal";

const GraphView: React.FC = () => {
  const { graph, addNode, updateNode, deleteNode, addEdge, updateEdge, deleteEdge } = useContext(GraphContext);
  const container = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  
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
  
  const [editNodeForm, setEditNodeForm] = useState({ label: "", type: "" });
  const [editEdgeForm, setEditEdgeForm] = useState({ label: "" });
  const [newNodeForm, setNewNodeForm] = useState({ label: "", type: "PERSON" });
  const [newEdgeForm, setNewEdgeForm] = useState({ from: 0, to: 0, label: "" });

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
      };

      const nodes = new DataSet(
        graph.nodes.map(node => ({
          id: node.id,
          label: node.label,
          title: `${node.type}: ${node.label}`,
          shape: "dot",
          size: 20,
          color: {
            background: nodeColors[node.type] || "#6b7280",
            border: "#ffffff",
            highlight: {
              background: nodeColors[node.type] || "#6b7280",
              border: "#000000"
            }
          },
          font: { color: "#ffffff", size: 12 }
        }))
      );

      const getFilteredEdges = () => {
        let filtered = graph.edges;
        if (edgeFilter !== "all") {
          filtered = filtered.filter(e => e.source === edgeFilter);
        }
        if (!showAllEdges && filtered.length > 50) {
          const priorityMap: Record<string, number> = {
            dependency: 3,
            pattern: 2,
            semantic: 1
          };
          filtered = filtered
            .sort((a, b) => (priorityMap[b.source || ""] || 0) - (priorityMap[a.source || ""] || 0))
            .slice(0, 50);
        }
        return filtered;
      };

      const edges = new DataSet(
        getFilteredEdges().map((edge, idx) => ({
          id: `edge-${idx}`,
          from: edge.from,
          to: edge.to,
          label: showAllEdges ? "" : edge.label,
          title: `${edge.label} (${edge.source || "unknown"})`,
          arrows: "to",
          color: {
            color: edge.source === "dependency" ? "#3b82f6" :
                   edge.source === "pattern" ? "#10b981" :
                   edge.source === "semantic" ? "#f59e0b" : "#6b7280",
            opacity: 0.3,
            highlight: "#000000"
          },
          font: { size: 10, align: "middle" },
          width: 1,
          smooth: {
            enabled: true,
            type: "cubicBezier",
            roundness: 0.6
          }
        }))
      );

      const data = { nodes, edges };

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
                parentCentralization: true
              }
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
                parentCentralization: true
              }
            };
          case "force":
          default:
            return {
              randomSeed: 42,
              improvedLayout: true,
              hierarchical: false
            };
        }
      };

      const options = {
        nodes: {
          borderWidth: 2,
          borderWidthSelected: 4,
          font: { color: "#ffffff", size: 12 }
        },
        edges: {
          smooth: {
            enabled: true,
            type: "continuous",
            roundness: 0.5
          }
        },
        physics: {
          enabled: layoutType === "force",
          stabilization: {
            enabled: true,
            iterations: 400,
            updateInterval: 50
          },
          barnesHut: {
            gravitationalConstant: -20000,
            centralGravity: 0.3,
            springLength: 250,
            springConstant: 0.02,
            damping: 0.5,
            avoidOverlap: 1
          }
        },
        interaction: {
          dragNodes: true,
          dragView: true,
          zoomView: true,
          hover: true,
          hoverConnectedEdges: true,
          tooltipDelay: 100,
          navigationButtons: false
        },
        layout: getLayoutConfig()
      };

      networkRef.current = new Network(container.current, data, options);

      networkRef.current.on("selectNode", (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = graph.nodes.find(n => n.id === nodeId);
          if (node) {
            const connections = graph.edges.filter(
              e => e.from === nodeId || e.to === nodeId
            ).length;
            setSelectedNode({
              id: node.id,
              label: node.label,
              type: node.type,
              connections
            });
            setEditNodeForm({ label: node.label, type: node.type });
            setSelectedEdge(null);
            setIsEditingEdge(false);
            setShowDetailsPanel(true);
          }
        }
      });

      networkRef.current.on("selectEdge", (params) => {
        if (params.edges.length > 0) {
          const edgeId = params.edges[0];
          const edgeIndex = parseInt(edgeId.toString().replace("edge-", ""));
          const edge = getFilteredEdges()[edgeIndex];
          if (edge) {
            setSelectedEdge(edge);
            setEditEdgeForm({ label: edge.label });
            setSelectedNode(null);
            setIsEditingNode(false);
            setShowDetailsPanel(true);
          }
        }
      });

      networkRef.current.on("deselectNode", () => {
        setSelectedNode(null);
        setIsEditingNode(false);
      });
      networkRef.current.on("deselectEdge", () => {
        setSelectedEdge(null);
        setIsEditingEdge(false);
      });
    }
  }, [graph, layoutType, showAllEdges, edgeFilter]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (networkRef.current && graph) {
      const matchingNodes = graph.nodes.filter(node =>
        node.label.toLowerCase().includes(query.toLowerCase())
      );
      if (matchingNodes.length > 0) {
        networkRef.current.selectNodes(matchingNodes.map(n => n.id));
        networkRef.current.focus(matchingNodes[0].id, { scale: 1.5, animation: true });
      }
    }
  };

  const handleZoomIn = () => networkRef.current?.moveTo({ scale: networkRef.current.getScale() * 1.2 });
  const handleZoomOut = () => networkRef.current?.moveTo({ scale: networkRef.current.getScale() * 0.8 });
  const handleResetView = () => networkRef.current?.fit({ animation: true });

  const handleSaveNodeEdit = () => {
    if (selectedNode) {
      updateNode(selectedNode.id, editNodeForm);
      setIsEditingNode(false);
    }
  };

  const handleDeleteNode = () => {
    if (selectedNode && window.confirm(`Delete node "${selectedNode.label}"?`)) {
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
      const newId = Math.max(...graph.nodes.map(n => n.id), 0) + 1;
      addNode({
        id: newId,
        label: newNodeForm.label,
        type: newNodeForm.type
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
        source: "manual"
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
            <h2 className="text-xl font-semibold text-emerald-400">Knowledge Graph</h2>
            {graph?.metadata && (
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>📊 {graph.metadata.total_entities} entities</span>
                <span>🔗 {graph.metadata.total_relationships} relationships</span>
              </div>
            )}
          </div>

          {/* Right: Edit Mode */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              editMode ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-emerald-500 hover:text-black"
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
            <option value="hierarchical-vertical">Hierarchical (Vertical)</option>
            <option value="hierarchical-horizontal">Hierarchical (Horizontal)</option>
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

          <button onClick={handleZoomIn} className="px-3 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold">+</button>
          <button onClick={handleZoomOut} className="px-3 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold">-</button>
          <button onClick={handleResetView} className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">Reset</button>
          
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

      {/* Graph Canvas - Full Height */}
      <div className="absolute inset-0 pt-40 pb-0">
        <div ref={container} className="w-full h-full bg-[#0f0f0f]"></div>
      </div>

      {/* Floating Details Panel (Right Side) */}
      {showDetailsPanel && (selectedNode || selectedEdge) && (
        <div className="absolute top-44 right-4 w-80 bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 z-30 shadow-2xl max-h-[calc(100vh-200px)] overflow-y-auto">
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
            <div className="bg-[#0a0a0a] border border-emerald-500 p-4 rounded-lg">
              <h4 className="font-semibold text-emerald-400 mb-3">Node Details</h4>
              
              {!isEditingNode ? (
                <>
                  <p className="mt-2 text-gray-300"><strong className="text-gray-400">Label:</strong> {selectedNode.label}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">Type:</strong> {selectedNode.type}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">Connections:</strong> {selectedNode.connections}</p>
                  
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
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">Label</label>
                    <input
                      type="text"
                      value={editNodeForm.label}
                      onChange={(e) => setEditNodeForm({ ...editNodeForm, label: e.target.value })}
                      className="w-full px-2 py-1 bg-[#0a0a0a] border border-gray-800 rounded text-gray-300 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">Type</label>
                    <select
                      value={editNodeForm.type}
                      onChange={(e) => setEditNodeForm({ ...editNodeForm, type: e.target.value })}
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
            </div>
          )}

          {selectedEdge && (
            <div className="bg-[#0a0a0a] border border-purple-600 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-400 mb-3">Relationship Details</h4>
              
              {!isEditingEdge ? (
                <>
                  <p className="mt-2 text-gray-300"><strong className="text-gray-400">From:</strong> Node {selectedEdge.from}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">To:</strong> Node {selectedEdge.to}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">Type:</strong> {selectedEdge.label}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">Source:</strong> {selectedEdge.source || "unknown"}</p>
                  
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
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-400">Relationship Label</label>
                    <input
                      type="text"
                      value={editEdgeForm.label}
                      onChange={(e) => setEditEdgeForm({ label: e.target.value })}
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

      {/* Legend (Bottom Left) */}
      {graph && graph.nodes.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-[#0f0f0f] border border-gray-800 rounded-lg p-3 z-20 text-xs text-gray-400">
          <strong className="text-emerald-400">Entity Types:</strong>
          <div className="mt-2 space-y-1">
            <span className="block" style={{ color: "#ef4444" }}>● Person</span>
            <span className="block" style={{ color: "#3b82f6" }}>● Organization</span>
            <span className="block" style={{ color: "#10b981" }}>● Location</span>
            <span className="block" style={{ color: "#f59e0b" }}>● Date</span>
            <span className="block" style={{ color: "#8b5cf6" }}>● Event</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!graph || graph.nodes.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium mb-2">No Graph Loaded</p>
            <p className="text-sm">Upload a document to generate a knowledge graph</p>
          </div>
        </div>
      )}

      {/* Add Node Modal */}
      {showAddNodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 text-emerald-400">Add New Node</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Label</label>
                <input
                  type="text"
                  value={newNodeForm.label}
                  onChange={(e) => setNewNodeForm({ ...newNodeForm, label: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter entity name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Type</label>
                <select
                  value={newNodeForm.type}
                  onChange={(e) => setNewNodeForm({ ...newNodeForm, type: e.target.value })}
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
            <h3 className="text-lg font-semibold mb-4 text-purple-400">Add New Relationship</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">From Node ID</label>
                <input
                  type="number"
                  value={newEdgeForm.from || ""}
                  onChange={(e) => setNewEdgeForm({ ...newEdgeForm, from: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Enter source node ID..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">To Node ID</label>
                <input
                  type="number"
                  value={newEdgeForm.to || ""}
                  onChange={(e) => setNewEdgeForm({ ...newEdgeForm, to: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Enter target node ID..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-400">Relationship Label</label>
                <input
                  type="text"
                  value={newEdgeForm.label}
                  onChange={(e) => setNewEdgeForm({ ...newEdgeForm, label: e.target.value })}
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