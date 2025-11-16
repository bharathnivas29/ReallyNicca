import React from "react";
import Home from "./pages/Home";
import { GraphProvider } from "./context/GraphContext";
import SaveExportPanel from './components/SaveExportPanel';


function App() {
  return (
    <GraphProvider>
      <Home />
    </GraphProvider>
  );
}

export default App;
