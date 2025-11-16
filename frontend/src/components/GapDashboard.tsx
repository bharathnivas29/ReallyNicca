import React, { useState, useContext } from 'react';
import { GraphContext } from '../context/GraphContext';

export interface Gap {
  title: string;
  description: string;
  significance: string;
  cluster_1_keywords: string[];
  cluster_2_keywords: string[];
  bridge_suggestion: string;
  gap_score: number;
  semantic_distance: number;
  bridge_nodes: string[];
}
interface GapDashboardProps {
  onSelectGap?: (gap: Gap | null) => void;
}

const GapDashboard: React.FC<GapDashboardProps> = ({ onSelectGap }) => {
  const { graph } = useContext(GraphContext);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGap, setSelectedGap] = useState<Gap | null>(null);

  const analyzeGaps = async () => {
    if (!graph || graph.nodes.length < 5) {
      alert('Graph too small for gap analysis. Need at least 5 nodes.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/gaps/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: graph.nodes,
          edges: graph.edges
        })
      });

      const data = await response.json();
      setGaps(data.gaps || []);
      console.log(`Found ${data.gaps.length} gaps`);
    } catch (error) {
      console.error('Gap analysis failed:', error);
      alert('Failed to analyze gaps. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'High': return 'text-red-400 bg-red-950';
      case 'Medium': return 'text-yellow-400 bg-yellow-950';
      case 'Low': return 'text-gray-400 bg-gray-900';
      default: return 'text-gray-400 bg-gray-900';
    }
  };

  return (
    <div className="p-6 bg-[#0a0a0a] border border-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-emerald-500">🔍 Gap Discovery</h2>
        <button
          onClick={analyzeGaps}
          disabled={loading || !graph}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
        >
          {loading ? 'Analyzing...' : 'Discover Gaps'}
        </button>
      </div>

      {gaps.length === 0 && !loading && (
        <p className="text-gray-500 text-center py-8">
          Click "Discover Gaps" to analyze your knowledge graph for missing connections.
        </p>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p className="text-gray-400 mt-2">Analyzing graph structure...</p>
        </div>
      )}

      <div className="space-y-4">
        {gaps.map((gap, index) => (
          <div
            key={index}
            className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-emerald-700 cursor-pointer transition"
            onClick={() => {
              setSelectedGap(gap);
              onSelectGap?.(gap);
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-white">{gap.title}</h3>
              <span className={`px-2 py-1 rounded text-xs font-bold ${getSignificanceColor(gap.significance)}`}>
                {gap.significance}
              </span>
            </div>

            <p className="text-gray-400 text-sm mb-3">{gap.description}</p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Cluster 1:</p>
                <div className="flex flex-wrap gap-1">
                  {gap.cluster_1_keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-1">Cluster 2:</p>
                <div className="flex flex-wrap gap-1">
                  {gap.cluster_2_keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-emerald-400 text-sm font-medium">💡 {gap.bridge_suggestion}</p>
            </div>

            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span>Gap Score: {gap.gap_score.toFixed(1)}</span>
              <span>Semantic Distance: {gap.semantic_distance.toFixed(2)}</span>
              {gap.bridge_nodes.length > 0 && (
                <span>Bridge Nodes: {gap.bridge_nodes.join(', ')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GapDashboard;
