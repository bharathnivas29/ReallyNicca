import React, { useEffect, useState } from "react";

interface SavedGraph {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  node_count: number;
  edge_count: number;
}

interface SavedGraphsProps {
  onLoad: (id: string) => void;
  onClose: () => void;
}

const SavedGraphs: React.FC<SavedGraphsProps> = ({ onLoad, onClose }) => {
  const [graphs, setGraphs] = useState<SavedGraph[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGraphs();
  }, []);

  const fetchGraphs = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/graphs');
      const data = await response.json();
      setGraphs(data);
    } catch (error) {
      console.error('Error fetching graphs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete graph "${name}"?`)) {
      try {
        await fetch(`http://localhost:5000/api/graphs/${id}`, { method: 'DELETE' });
        fetchGraphs();
      } catch (error) {
        console.error('Error deleting graph:', error);
      }
    }
  };

  const handleExport = (id: string, format: 'json' | 'csv') => {
    window.open(`http://localhost:5000/api/graphs/${id}/export/${format}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-emerald-400">Saved Graphs</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : graphs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No saved graphs yet</div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="space-y-3">
              {graphs.map((graph) => (
                <div
                  key={graph.id}
                  className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-emerald-500 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-gray-300 font-semibold">{graph.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {graph.node_count} entities • {graph.edge_count} relationships
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Created: {new Date(graph.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onLoad(graph.id)}
                        className="px-3 py-1 bg-emerald-500 text-black rounded text-sm hover:bg-emerald-400 transition-colors font-semibold"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleExport(graph.id, 'json')}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-500 transition-colors"
                      >
                        JSON
                      </button>
                      <button
                        onClick={() => handleExport(graph.id, 'csv')}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-500 transition-colors"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => handleDelete(graph.id, graph.name)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedGraphs;