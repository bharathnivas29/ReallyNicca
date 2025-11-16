import React, { useContext, useState } from "react";
import { GraphContext } from "../context/GraphContext";
import SaveGraphModal from "./SaveGraphModal";
import SavedGraphs from "./SavedGraphs"

const SaveExportPanel: React.FC = () => {
  const { graph, setGraph } = useContext(GraphContext);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedGraphs, setShowSavedGraphs] = useState(false);
  const [currentGraphId, setCurrentGraphId] = useState<string | null>(null);

  const handleSaveGraph = async (name: string) => {
    if (!graph) return;

      // ✅ DEBUG: Check what we're sending
    console.log('Graph to save:', {
      name,
      nodes: graph.nodes.slice(0, 2), // First 2 nodes
      edges: graph.edges.slice(0, 2)  // First 2 edges
    });

    try {
      const response = await fetch('http://localhost:5000/api/graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nodes: graph.nodes,
          edges: graph.edges
        })
      });
      
      const data = await response.json();
      console.log('Save response:', data);
      setCurrentGraphId(data.id);
      alert('✅ Graph saved successfully!');
    } catch (error) {
      console.error('Error saving graph:', error);
      alert('❌ Failed to save graph');
    }
  };

  const handleLoadGraph = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/graphs/${id}`);
      const data = await response.json();
      
      setGraph({
        nodes: data.nodes,
        edges: data.edges,
        metadata: {
          total_entities: data.nodes.length,
          total_relationships: data.edges.length,
          dependency_edges: data.edges.filter((e: any) => e.source === 'dependency').length,
          pattern_edges: data.edges.filter((e: any) => e.source === 'pattern').length,
          semantic_edges: data.edges.filter((e: any) => e.source === 'semantic').length
        }
      });
      
      setCurrentGraphId(id);
      setShowSavedGraphs(false);
      alert('✅ Graph loaded successfully!');
    } catch (error) {
      console.error('Error loading graph:', error);
      alert('❌ Failed to load graph');
    }
  };

  const handleExportJSON = () => {
    if (!graph) return;
    
    const dataStr = JSON.stringify(graph, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!graph) return;
    
    let csv = 'NODES\nid,label,type\n';
    graph.nodes.forEach(n => csv += `${n.id},"${n.label}",${n.type}\n`);
    csv += '\nEDGES\nfrom,to,label,source\n';
    graph.edges.forEach(e => csv += `${e.from},${e.to},"${e.label}",${e.source || ''}\n`);
    
    const dataBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-gray-800 bg-[#1a1a1a] rounded-lg p-4 my-4">
      <h3 className="text-lg font-semibold mb-4 text-emerald-400">Save & Export</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Save Section */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400 mb-2">💾 Storage</p>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!graph || graph.nodes.length === 0}
            className="w-full px-4 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Graph
          </button>
          <button
            onClick={() => setShowSavedGraphs(true)}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-semibold"
          >
            Load Saved
          </button>
        </div>

        {/* Export Section */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400 mb-2">📤 Export</p>
          <button
            onClick={handleExportJSON}
            disabled={!graph || graph.nodes.length === 0}
            className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!graph || graph.nodes.length === 0}
            className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>

      {currentGraphId && (
        <p className="text-xs text-gray-500 mt-3">
          Current graph ID: {currentGraphId}
        </p>
      )}

      {/* Modals */}
      <SaveGraphModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveGraph}
      />

      {showSavedGraphs && (
        <SavedGraphs
          onLoad={handleLoadGraph}
          onClose={() => setShowSavedGraphs(false)}
        />
      )}
    </div>
  );
};

export default SaveExportPanel;