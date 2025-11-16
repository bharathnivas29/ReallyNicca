import React, { useState } from "react";
import FileUpload from "../components/FileUpload";
import GraphView from "../components/GraphView";
import SaveExportPanel from "../components/SaveExportPanel";
import GapDashboard, { Gap } from "../components/GapDashboard";
import IdeaGenerator from "../components/IdeaGenerator";

const Home: React.FC = () => {
  const [selectedGap, setSelectedGap] = useState<Gap | null>(null);

  return (
    <div className="w-full bg-[#0a0a0a] overflow-x-hidden">
      {/* Section 1: Graph + Sidebar (Full Viewport Height) */}
      <section className="min-h-[110vh] flex">
        {/* Graph View: 70% width, full height */}
        <div className="w-[70%] min-h-[110vh] bg-[#0a0a0a]">
          <GraphView />
        </div>

        {/* Sidebar: 30% width, full height */}
        <aside className="w-[30%] min-h-[110vh] border-l border-gray-800 bg-[#0f0f0f] flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-emerald-500 mb-1">
                Really Nicca
              </h1>
              <p className="text-sm text-gray-500">Knowledge Graph Builder</p>
            </div>

            {/* Upload */}
            <FileUpload />

            {/* Save & Export */}
            <SaveExportPanel />
          </div>
        </aside>
      </section>

      {/* Section 2: Gap Discovery + Ideas (Scroll Down to See) */}
      <section className="min-h-screen bg-[#0f0f0f] border-t-4 border-emerald-500">
        <div className="max-w-full px-6 py-12">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Discover Knowledge Gaps
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gap Discovery */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
              <GapDashboard onSelectGap={setSelectedGap} />
            </div>

            {/* Idea Generation */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
              {selectedGap ? (
                <IdeaGenerator gap={selectedGap} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
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
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold mb-2">
                      Generate Ideas
                    </h3>
                    <p className="text-sm">
                      Select a gap from the left to generate research ideas
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
