Phase 1: Project Foundations and Proof of Concept
Set up backend Node.js + Express API with file upload
Implemented PDF and text extraction (via pdf-parse and native file read)
Created Python NLP extractor using spaCy for entity extraction
Connected backend and frontend with React and Tailwind CSS
Created React components for file upload, graph visualization (vis-network), and context

Phase 2: Enhanced Extraction Logic
Upgraded to a three-level relationship extraction:
Dependency-based relationships via spaCy parse trees
Pattern-based heuristic relationships (locations, orgs, dates, citations)
Optional AI-powered semantic similarity using OpenAI embeddings
Added metadata reporting for extraction counts and breakdowns
Implemented color-coded edges in frontend vis-network graph to distinguish extraction methods

Phase 3: UX and UI Enhancements
Added metadata info display in the React graph view
Improved error handling and user experience in file upload and extraction flow
Ensured smooth state management and context updates in React



Date: 09-11-2025
✅ COMPLETED SO FAR
Backend (Node.js + Express + Python)
PDF/text upload and extraction
3-level NLP relationship extraction (spaCy):
Dependency parsing (syntax-based)
Pattern matching (heuristics)
Optional AI semantic similarity (OpenAI)
Metadata tracking (extraction stats)
Frontend (React + TypeScript + Vis.js)
File upload component
Graph context & state management

Basic graph visualization:
✅ Real-time display (nodes + edges)
✅ Color-coded by entity type
❌ No drag-and-drop
❌ No node/edge click details
❌ No zoom/pan/search controls

🚧 CURRENT FOCUS: Interactive Graph Visualization (Complete This First)
What We're Building Now:
✅ Real-time graph display → DONE

⏳ Drag-and-drop nodes → NEXT
⏳ Click nodes → show details panel
⏳ Click edges → show relationship details
⏳ Zoom, pan, search controls
⏳ Performance optimization (100+ nodes at 30 FPS)

📋 AFTER GRAPH VISUALIZATION: UPCOMING FEATURES
Feature 5: Human-in-Loop Editing
Edit/delete nodes and edges
Add missing entities manually
Feedback system (thumbs up/down)

Feature 6: Storage & Export
Save graphs with names/timestamps
Dashboard to list saved graphs
Export: JSON, CSV, PNG

Feature 7: LLM Chat Interface
Natural language queries
RAG-based answers grounded in graph data
Source node/edge citations