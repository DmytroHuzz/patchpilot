import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  IsolationRun,
  InvestigationResult,
  NormalizedScanResult,
  RemediationProposal,
} from "@patchpilot/contracts";
import "./styles.css";

type Status = "ready" | "scanning" | "investigating" | "planning" | "deciding" | "isolating" | "error";

function sentenceCase(value: string): string {
  return value.replaceAll("_", " ");
}

function App() {
  const [result, setResult] = useState<NormalizedScanResult>();
  const [investigation, setInvestigation] = useState<InvestigationResult>();
  const [proposal, setProposal] = useState<RemediationProposal>();
  const [isolation, setIsolation] = useState<IsolationRun>();
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState("");

  async function post<T>(url: string, requestBody?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      ...(requestBody === undefined ? {} : {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    });
    const responseBody = await response.json();
    if (!response.ok) throw new Error(responseBody.error ?? "Request failed");
    return responseBody;
  }

  async function scanDemo() {
    setStatus("scanning");
    setError("");
    setInvestigation(undefined);
    setProposal(undefined);
    setIsolation(undefined);
    try {
      setResult(await post<NormalizedScanResult>("/api/demo/scan"));
      setStatus("ready");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed");
      setStatus("error");
    }
  }

  async function investigateDemo() {
    setStatus("investigating");
    setError("");
    setProposal(undefined);
    setIsolation(undefined);
    try {
      setInvestigation(await post<InvestigationResult>("/api/demo/investigate"));
      setStatus("ready");
    } catch (investigationError) {
      setError(investigationError instanceof Error ? investigationError.message : "Investigation failed");
      setStatus("error");
    }
  }

  async function reviewRemediationPlan() {
    setStatus("planning");
    setError("");
    try {
      setProposal(await post<RemediationProposal>("/api/demo/remediation-plan"));
      setStatus("ready");
    } catch (planningError) {
      setError(planningError instanceof Error ? planningError.message : "Planning failed");
      setStatus("error");
    }
  }

  async function recordDecision(decision: "approved" | "cancelled") {
    if (!proposal) return;
    setStatus("deciding");
    setError("");
    try {
      setProposal(await post<RemediationProposal>("/api/demo/remediation-decision", {
        planId: proposal.id,
        decision,
      }));
      setStatus("ready");
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Decision failed");
      setStatus("error");
    }
  }

  async function isolateApprovedPlan() {
    if (!proposal || proposal.status !== "approved") return;
    setStatus("isolating");
    setError("");
    try {
      setIsolation(await post<IsolationRun>("/api/demo/isolate", { planId: proposal.id }));
      setStatus("ready");
    } catch (isolationError) {
      setError(isolationError instanceof Error ? isolationError.message : "Isolation failed");
      setStatus("error");
    }
  }

  const finding = result?.findings.find(({ id }) => id === "GHSA-9c47-m6qq-7p4h");
  const assessment = investigation?.assessmentRun.assessment;
  const assessmentSource = investigation?.assessmentRun.source;
  const plan = proposal?.planRun.plan;

  return (
    <div className="shell">
      <header>
        <span className="mark">P</span><strong>PatchPilot</strong>
        <nav><span className="active">01 Detect</span><span className={finding ? "active" : ""}>02 Investigate</span><span className={proposal ? "active" : ""}>03 Approve</span><span className={isolation ? "active" : ""}>04 Isolate</span></nav>
        <span className="stage">M3 / ISOLATED EXECUTION</span>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">BUNDLED GOLDEN REPOSITORY</p>
            <h1>Facts first.<br /><em>Judgment second.</em></h1>
            <p className="lede">Detect a real npm vulnerability, collect exact repository evidence, then ask GPT‑5.6 for a schema-bound interpretation with uncertainty left visible.</p>
          </div>
          <div className="repo-card">
            <div className="repo-top"><span className="pulse" /> READY FOR DETERMINISTIC SCAN</div>
            <h2>patchpilot-golden-demo</h2>
            <p>Node.js · npm · direct dependency</p>
            <code>demo/vulnerable-node-app</code>
            <button onClick={scanDemo} disabled={["scanning", "investigating", "planning", "deciding", "isolating"].includes(status)}>
              {status === "scanning" ? "Scanning with OSV…" : "Run deterministic scan"}<span>→</span>
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </section>

        {finding && <section className="result" aria-live="polite">
          <div className="result-head">
            <div><p className="eyebrow">01 · DETERMINISTIC FINDING</p><h2>{finding.summary}</h2></div>
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
          <div className="next-action">
            <div><strong>Finding confirmed.</strong><span>Collect bounded code evidence before interpreting relevance.</span></div>
            <button className="secondary" onClick={investigateDemo} disabled={status === "investigating"}>
              {status === "investigating" ? "Collecting evidence…" : "Investigate affectedness"}<span>→</span>
            </button>
          </div>
          <footer><span>✓ OSV-Scanner {result?.scannerVersion}</span><span>LIVE RESULT · {new Date(result!.scannedAt).toLocaleTimeString()}</span></footer>
        </section>}

        {investigation && assessment && <section className="investigation" aria-live="polite">
          <div className="investigation-title">
            <div><p className="eyebrow">02 · BOUNDED INVESTIGATION</p><h2>Why this finding matters here.</h2></div>
            <div className={`source-badge ${assessmentSource === "openai" ? "live" : "cached"}`}>
              <span>{assessmentSource === "openai" ? "LIVE OPENAI" : "CACHED CONTRACT FIXTURE"}</span>
              <strong>GPT‑5.6 · STRUCTURED OUTPUT</strong>
            </div>
          </div>

          <div className="investigation-grid">
            <article className="panel advisory-panel">
              <div className="panel-label"><span>01</span> DETERMINISTIC ADVISORY FACTS</div>
              <h3>{investigation.advisory.id}</h3>
              <p>{investigation.advisory.summary}</p>
              <dl>
                <div><dt>Affected</dt><dd>{investigation.advisory.affectedRanges.join(" · ")}</dd></div>
                <div><dt>Fixed</dt><dd>{investigation.advisory.fixedVersions.join(" · ")}</dd></div>
                <div><dt>Source</dt><dd>{investigation.advisory.source}</dd></div>
              </dl>
              <div className="fact-note">Scanner and advisory data are facts—not model output.</div>
            </article>

            <article className="panel evidence-panel">
              <div className="panel-label"><span>02</span> REPOSITORY EVIDENCE</div>
              <div className="evidence-list">
                {investigation.evidence.items.map((item) => <div className={`evidence-item ${item.type}`} key={item.id}>
                  <div><code>{item.id}</code><span>{item.type}</span></div>
                  {item.file && <strong>{item.file}:{item.startLine}{item.endLine !== item.startLine ? `–${item.endLine}` : ""}</strong>}
                  {item.excerpt && <pre>{item.excerpt}</pre>}
                  {!item.file && <p>{item.explanation}</p>}
                </div>)}
              </div>
              <div className="bounds">{investigation.evidence.searchedFiles.length} files · {investigation.evidence.searchedBytes.toLocaleString()} bytes · {investigation.evidence.truncated ? "truncated" : "complete within bounds"}</div>
            </article>

            <article className="panel interpretation-panel">
              <div className="panel-label"><span>03</span> MODEL-SUPPORTED INTERPRETATION</div>
              <div className="verdict-row">
                <div><small>VERDICT</small><strong>{sentenceCase(assessment.verdict)}</strong></div>
                <span className="confidence">{assessment.confidence} confidence</span>
              </div>
              <p className="rationale">{assessment.rationale}</p>
              <div className="citations"><span>CITED EVIDENCE</span>{[...assessment.supportingEvidenceIds, ...assessment.counterEvidenceIds].map((id) => <code key={id}>{id}</code>)}</div>
              <div className="interpretation-note">Interpretation is schema-validated. It does not prove exploitability.</div>
            </article>
          </div>

          <div className="uncertainty-grid">
            <div><p className="panel-label"><span>?</span> UNKNOWNS</p><ul>{assessment.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="panel-label"><span>!</span> LIMITATIONS</p><ul>{assessment.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="panel-label"><span>→</span> NEXT CHECKS</p><ul>{assessment.recommendedNextChecks.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
          {assessmentSource === "cached-demo" && <div className="fixture-notice">No API key detected. Showing the checked-in GPT‑5.6 contract fixture; the same schema, citation, and uncertainty validators run in live mode.</div>}
          <div className="plan-launch">
            <div><strong>Investigation complete.</strong><span>Review every proposed file, command, test, and risk before granting permission.</span></div>
            <button className="secondary" onClick={reviewRemediationPlan} disabled={status === "planning" || status === "deciding"}>
              {status === "planning" ? "Building bounded plan…" : "Review remediation plan"}<span>→</span>
            </button>
          </div>
        </section>}

        {proposal && plan && <section className="remediation" aria-live="polite">
          <div className="remediation-title">
            <div><p className="eyebrow">03 · HUMAN APPROVAL GATE</p><h2>Review the exact change boundary.</h2></div>
            <div className={`source-badge ${proposal.planRun.source === "openai" ? "live" : "cached"}`}>
              <span>{proposal.planRun.source === "openai" ? "LIVE OPENAI" : "CACHED CONTRACT FIXTURE"}</span>
              <strong>GPT‑5.6 · REMEDIATION PLAN</strong>
            </div>
          </div>

          <div className="plan-summary">
            <div><span>TARGET</span><strong>json5 {investigation?.finding.installedVersion} <em>→</em> {plan.targetVersion}</strong></div>
            <div><span>STRATEGY</span><strong>{sentenceCase(plan.strategy)}</strong></div>
            <div><span>WRITE STATE</span><strong className="locked">● LOCKED</strong></div>
          </div>

          <div className="plan-explanation">
            <p className="panel-label"><span>i</span> PROPOSED APPROACH</p>
            <p>{plan.explanation}</p>
          </div>

          <div className="plan-grid">
            <article>
              <p className="panel-label"><span>01</span> EXPECTED FILES</p>
              <div className="plan-items files">{plan.expectedFiles.map((file) => <code key={file}>{file}</code>)}</div>
            </article>
            <article>
              <p className="panel-label"><span>02</span> COMPATIBILITY RISKS</p>
              <ul>{plan.expectedCompatibilityRisks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
            </article>
            <article>
              <p className="panel-label"><span>03</span> PLANNED COMMANDS</p>
              <div className="plan-items commands">{plan.proposedCommands.map((command) => <code key={command}>$ {command}</code>)}</div>
            </article>
            <article>
              <p className="panel-label"><span>04</span> VERIFICATION INTENT</p>
              <ul>{plan.proposedTests.map((test) => <li key={test}>{test}</li>)}</ul>
            </article>
          </div>

          <div className="approval-lock">
            <div className="lock-icon">⌁</div>
            <div><strong>No repository write has occurred.</strong><span>Approval is recorded against this exact plan ID. Any content change invalidates the gate.</span><code>{proposal.id}</code></div>
          </div>

          {proposal.status === "awaiting_approval" ? <div className="approval-actions">
            <button className="cancel-button" onClick={() => recordDecision("cancelled")} disabled={status === "deciding"}>
              Cancel · leave repository unchanged
            </button>
            <button className="approve-button" onClick={() => recordDecision("approved")} disabled={status === "deciding"}>
              {status === "deciding" ? "Recording decision…" : "Approve this exact plan"}<span>→</span>
            </button>
          </div> : <div className={`decision-result ${proposal.status}`}>
            <div><span>{proposal.status === "approved" ? "✓" : "×"}</span></div>
            <div>
              <strong>{proposal.status === "approved" ? "Approval recorded. The exact plan may enter isolation." : "Plan cancelled. Repository remains unchanged."}</strong>
              <p>{proposal.status === "approved" ? "Create a dedicated branch and worktree before any dependency or source change." : "A cancelled decision cannot be converted into approval. Generate a new plan after restarting the demo."}</p>
              <code>{proposal.approval?.recordedAt}</code>
            </div>
          </div>}
          {proposal.status === "approved" && !isolation && <div className="isolation-launch">
            <div>
              <strong>Approval boundary passed.</strong>
              <span>The source checkout must be clean. Isolation creates a local branch and separate worktree only.</span>
            </div>
            <button className="approve-button" onClick={isolateApprovedPlan} disabled={status === "isolating"}>
              {status === "isolating" ? "Validating and isolating…" : "Create isolated workspace"}<span>→</span>
            </button>
          </div>}
          {error && <div className="decision-error">{error}</div>}
        </section>}

        {isolation && <section className="isolation" aria-live="polite">
          <div className="isolation-title">
            <div><p className="eyebrow">04 · CONTROLLED GIT ISOLATION</p><h2>Clean source. Separate runway.</h2></div>
            <div className="isolation-badge"><span>✓ SOURCE CHECKOUT CLEAN</span><strong>WORKTREE READY</strong></div>
          </div>

          <div className="isolation-facts">
            <div><span>BASELINE</span><code>{isolation.baselineCommit.slice(0, 12)}</code></div>
            <div><span>SOURCE BRANCH</span><strong>{isolation.sourceBranch}</strong></div>
            <div><span>ISOLATED BRANCH</span><code>{isolation.branchName}</code></div>
          </div>

          <div className="isolation-grid">
            <article>
              <p className="panel-label"><span>01</span> VALIDATED BOUNDARIES</p>
              <dl>
                <div><dt>Worktree</dt><dd>runs/worktrees/{isolation.id}</dd></div>
                <div><dt>Selected repository</dt><dd>demo/vulnerable-node-app</dd></div>
                <div><dt>Audit record</dt><dd>runs/audit/{isolation.id}.json</dd></div>
              </dl>
            </article>
            <article>
              <p className="panel-label"><span>02</span> ACTION AUDIT</p>
              <ol className="audit-list">{isolation.events.map((event) => <li key={event.sequence}>
                <span>✓</span><div><strong>{sentenceCase(event.action)}</strong><p>{event.detail}</p></div>
              </li>)}</ol>
            </article>
          </div>

          <div className="isolation-ready">
            <div className="ready-icon">◇</div>
            <div><strong>No patch has been applied.</strong><span>All future writes are constrained to the isolated repository. Automatic push and merge remain disabled.</span></div>
            <code>{isolation.id}</code>
          </div>
        </section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
