import React, { useState } from 'react';

interface Gap {
  title: string;
  description: string;
  significance: string;
  cluster_1_keywords: string[];
  cluster_2_keywords: string[];
  gap_score: number;
  semantic_distance: number;
}

interface Idea {
  bridging_question: string;
  novelty: string;
  methodology: string;
  impact: string;
  novelty_score: number;
}

interface IdeaGeneratorProps {
  gap: Gap;
}

const IdeaGenerator: React.FC<IdeaGeneratorProps> = ({ gap }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);

  const generateIdeas = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap })
      });

      const data = await response.json();
      setIdeas(data.ideas || []);
      console.log(`Generated ${data.ideas.length} ideas`);
    } catch (error) {
      console.error('Idea generation failed:', error);
      alert('Failed to generate ideas. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high': return 'text-emerald-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6 bg-[#0a0a0a] border border-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-purple-500">💡 Idea Generator</h2>
        <button
          onClick={generateIdeas}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Ideas'}
        </button>
      </div>

      <div className="mb-4 p-3 bg-gray-900 rounded-lg border border-gray-800">
        <p className="text-sm text-gray-400">Generating ideas for:</p>
        <p className="text-white font-semibold">{gap.title}</p>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="text-gray-400 mt-2">AI is generating novel research ideas...</p>
        </div>
      )}

      <div className="space-y-4">
        {ideas.map((idea, index) => (
          <div
            key={index}
            className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-purple-700 transition"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-white">
                {index + 1}. {idea.bridging_question}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Novelty: {idea.novelty_score}/100</span>
                <span className={`text-sm font-bold ${getImpactColor(idea.impact)}`}>
                  {idea.impact} Impact
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500 font-medium">Why it's novel:</p>
                <p className="text-gray-300">{idea.novelty}</p>
              </div>

              <div>
                <p className="text-gray-500 font-medium">Suggested methodology:</p>
                <p className="text-gray-300">{idea.methodology}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IdeaGenerator;