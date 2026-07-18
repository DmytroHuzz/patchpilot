import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main>
      <p className="eyebrow">PATCHPILOT / BUILD WEEK 2026</p>
      <h1>Evidence before remediation.</h1>
      <p className="lede">The deterministic scan workflow is being assembled.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

