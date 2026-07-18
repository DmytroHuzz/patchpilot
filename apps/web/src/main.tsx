import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { NormalizedScanResult } from "@patchpilot/contracts";
import "./styles.css";

function App() {
  const [result, setResult] = useState<NormalizedScanResult>();
  const [status, setStatus] = useState<"ready" | "scanning" | "error">("ready");
  const [error, setError] = useState("");

  async function scanDemo() {
    setStatus("scanning");
    setError("");
    try {
      const response = await fetch("/api/demo/scan", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Scan failed");
      setResult(body);
      setStatus("ready");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed");
      setStatus("error");
    }
  }

  const finding = result?.findings.find(({ id }) => id === "GHSA-9c47-m6qq-7p4h");

  return (
    <div className="shell">
      <header><span className="mark">P</span><strong>PatchPilot</strong><span className="stage">M1 / DETERMINISTIC SCAN</span></header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">BUNDLED GOLDEN REPOSITORY</p>
            <h1>Start with<br />the facts.</h1>
            <p className="lede">One real npm vulnerability. Detected by OSV-Scanner, normalized for review, with no model interpretation.</p>
          </div>
          <div className="repo-card">
            <div className="repo-top"><span className="pulse" /> READY TO SCAN</div>
            <h2>patchpilot-golden-demo</h2>
            <p>Node.js · npm · direct dependency</p>
            <code>demo/vulnerable-node-app</code>
            <button onClick={scanDemo} disabled={status === "scanning"}>
              {status === "scanning" ? "Scanning with OSV…" : "Run deterministic scan"}<span>→</span>
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </section>

        {finding && <section className="result" aria-live="polite">
          <div className="result-head">
            <div><p className="eyebrow">DETERMINISTIC FINDING</p><h2>{finding.summary}</h2></div>
            <span className="severity">{finding.severity ?? "UNKNOWN"}</span>
          </div>
          <div className="facts">
            <div><span>PACKAGE</span><strong>{finding.packageName}</strong></div>
            <div><span>INSTALLED</span><strong>{finding.installedVersion}</strong></div>
            <div><span>ADVISORY</span><strong>{finding.id}</strong></div>
            <div><span>FIXED</span><strong>{finding.fixedVersions.join(" · ")}</strong></div>
          </div>
          <div className="evidence-row">
            <div><span>Manifest</span><code>{finding.manifestPath}</code></div>
            <div><span>Dependency path</span><code>{finding.dependencyPath.join(" → ")}</code></div>
            <div><span>Affected range</span><code>{finding.affectedRanges.join("; ")}</code></div>
          </div>
          <footer><span>✓ OSV-Scanner {result?.scannerVersion}</span><span>LIVE RESULT · {new Date(result!.scannedAt).toLocaleTimeString()}</span></footer>
        </section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
