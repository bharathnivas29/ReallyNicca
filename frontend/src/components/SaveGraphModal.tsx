import React, { useState } from "react";

interface SaveGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

const SaveGraphModal: React.FC<SaveGraphModalProps> = ({ isOpen, onClose, onSave }) => {
  const [graphName, setGraphName] = useState("");

  const handleSave = () => {
    if (graphName.trim()) {
      onSave(graphName.trim());
      setGraphName("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4 text-emerald-400">Save Knowledge Graph</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-400">Graph Name</label>
            <input
              type="text"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-gray-300 placeholder-gray-600 focus:border-emerald-500 focus:outline-none"
              placeholder="e.g., Research Paper Analysis..."
              autoFocus
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!graphName.trim()}
              className="flex-1 px-4 py-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Graph
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveGraphModal;
