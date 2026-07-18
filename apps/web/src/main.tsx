import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  CompatibilityRepairResult,
  DependencyUpdateResult,
  EvidenceReportResult,
  GitHandoffResult,
  IsolationRun,
  InvestigationResult,
  NormalizedScanResult,
  RemediationProposal,
  TargetedTestResult,
  VerificationResult,
} from "@patchpilot/contracts";
import "./styles.css";

type Status = "ready" | "scanning" | "investigating" | "planning" | "deciding" | "isolating" | "updating" | "repairing" | "testing" | "verifying" | "reporting" | "handing_off" | "error";

function sentenceCase(value: string): string {
  return value.replaceAll("_", " ");
}

function App() {
  const [result, setResult] = useState<NormalizedScanResult>();
  const [investigation, setInvestigation] = useState<InvestigationResult>();
  const [proposal, setProposal] = useState<RemediationProposal>();
  const [isolation, setIsolation] = useState<IsolationRun>();
  const [dependencyUpdate, setDependencyUpdate] = useState<DependencyUpdateResult>();
  const [compatibilityRepair, setCompatibilityRepair] = useState<CompatibilityRepairResult>();
  const [targetedTest, setTargetedTest] = useState<TargetedTestResult>();
  const [verification, setVerification] = useState<VerificationResult>();
  const [evidenceReport, setEvidenceReport] = useState<EvidenceReportResult>();
  const [gitHandoff, setGitHandoff] = useState<GitHandoffResult>();
  const [copyLabel, setCopyLabel] = useState("Copy Markdown");
  const [prCopyLabel, setPrCopyLabel] = useState("Copy PR body");
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
    setDependencyUpdate(undefined);
    setCompatibilityRepair(undefined);
    setTargetedTest(undefined);
    setVerification(undefined);
    setEvidenceReport(undefined);
    setGitHandoff(undefined);
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
    setDependencyUpdate(undefined);
    setCompatibilityRepair(undefined);
    setTargetedTest(undefined);
    setVerification(undefined);
    setEvidenceReport(undefined);
    setGitHandoff(undefined);
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

  async function applyDependencyUpdate() {
    if (!proposal || !isolation) return;
    setStatus("updating");
    setError("");
    try {
      setDependencyUpdate(await post<DependencyUpdateResult>("/api/demo/dependency-update", {
        planId: proposal.id,
        runId: isolation.id,
      }));
      setStatus("ready");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Dependency update failed");
      setStatus("error");
    }
  }

  async function repairCompatibility() {
    if (!proposal || !isolation || !dependencyUpdate) return;
    setStatus("repairing");
    setError("");
    try {
      setCompatibilityRepair(await post<CompatibilityRepairResult>("/api/demo/compatibility-repair", {
        planId: proposal.id,
        runId: isolation.id,
      }));
      setStatus("ready");
    } catch (repairError) {
      setError(repairError instanceof Error ? repairError.message : "Compatibility repair failed");
      setStatus("error");
    }
  }

  async function generateRegressionTest() {
    if (!proposal || !isolation || !compatibilityRepair) return;
    setStatus("testing");
    setError("");
    try {
      setTargetedTest(await post<TargetedTestResult>("/api/demo/targeted-test", {
        planId: proposal.id,
        runId: isolation.id,
      }));
      setStatus("ready");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Targeted test generation failed");
      setStatus("error");
    }
  }

  async function runVerification() {
    if (!proposal || !isolation || !targetedTest) return;
    setStatus("verifying");
    setError("");
    setEvidenceReport(undefined);
    setGitHandoff(undefined);
    try {
      setVerification(await post<VerificationResult>("/api/demo/verification", {
        planId: proposal.id,
        runId: isolation.id,
      }));
      setStatus("ready");
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Verification failed");
      setStatus("error");
    }
  }

  async function generateReport() {
    if (!proposal || !isolation || verification?.status !== "verified") return;
    setStatus("reporting");
    setError("");
    try {
      setEvidenceReport(await post<EvidenceReportResult>("/api/demo/report", {
        planId: proposal.id,
        runId: isolation.id,
      }));
      setStatus("ready");
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Evidence report generation failed");
      setStatus("error");
    }
  }

  async function copyMarkdown() {
    if (!evidenceReport) return;
    await navigator.clipboard.writeText(evidenceReport.markdown);
    setCopyLabel("Copied ✓");
    window.setTimeout(() => setCopyLabel("Copy Markdown"), 1600);
  }

  async function createLocalHandoff() {
    if (!proposal || !isolation || !evidenceReport) return;
    setStatus("handing_off");
    setError("");
    try {
      setGitHandoff(await post<GitHandoffResult>("/api/demo/github-handoff", {
        planId: proposal.id,
        runId: isolation.id,
      }));
      setStatus("ready");
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "Git handoff failed");
      setStatus("error");
    }
  }

  async function copyPullRequestBody() {
    if (!gitHandoff) return;
    await navigator.clipboard.writeText(gitHandoff.pullRequestDraft.body);
    setPrCopyLabel("Copied ✓");
    window.setTimeout(() => setPrCopyLabel("Copy PR body"), 1600);
  }

  const finding = result?.findings.find(({ id }) => id === "GHSA-9c47-m6qq-7p4h");
  const assessment = investigation?.assessmentRun.assessment;
  const assessmentSource = investigation?.assessmentRun.source;
  const plan = proposal?.planRun.plan;

  return (
    <div className="shell">
      <header>
        <span className="mark">P</span><strong>PatchPilot</strong>
        <nav><span className="active">01 Detect</span><span className={finding ? "active" : ""}>02 Investigate</span><span className={proposal ? "active" : ""}>03 Approve</span><span className={isolation ? "active" : ""}>04 Isolate</span><span className={dependencyUpdate ? "active" : ""}>05 Update</span><span className={compatibilityRepair ? "active" : ""}>06 Repair</span><span className={targetedTest ? "active" : ""}>07 Test</span><span className={verification ? "active" : ""}>08 Verify</span><span className={evidenceReport ? "active" : ""}>09 Report</span><span className={gitHandoff ? "active" : ""}>10 Handoff</span></nav>
        <span className="stage">M4 / HANDOFF</span>
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
            <button onClick={scanDemo} disabled={["scanning", "investigating", "planning", "deciding", "isolating", "updating", "repairing", "testing", "verifying", "reporting"].includes(status)}>
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
          {!dependencyUpdate && <div className="dependency-launch">
            <div><strong>Isolation boundary passed.</strong><span>Run the one approved npm command. Only package.json and package-lock.json may change.</span></div>
            <button onClick={applyDependencyUpdate} disabled={status === "updating"}>
              {status === "updating" ? "Applying json5 1.0.2…" : "Apply approved dependency update"}<span>→</span>
            </button>
          </div>}
          {error && <div className="decision-error">{error}</div>}
        </section>}

        {dependencyUpdate && <section className="dependency-update" aria-live="polite">
          <div className="dependency-title">
            <div><p className="eyebrow">05 · APPROVED DEPENDENCY UPDATE</p><h2>Minimal version. Reviewable diff.</h2></div>
            <div className="dependency-badge"><span>✓ SOURCE CHECKOUT CLEAN</span><strong>DEPENDENCY ONLY</strong></div>
          </div>

          <div className="dependency-facts">
            <div><span>PACKAGE</span><strong>{dependencyUpdate.packageName}</strong></div>
            <div><span>VERSION</span><strong>{dependencyUpdate.fromVersion} <em>→</em> {dependencyUpdate.targetVersion}</strong></div>
            <div><span>CHANGED FILES</span><strong>{dependencyUpdate.changedFiles.length}</strong></div>
            <div><span>UNRELATED CHANGES</span><strong className="zero">0</strong></div>
          </div>

          <div className="command-proof">
            <p className="panel-label"><span>$</span> APPROVED COMMAND RESULT</p>
            <code>$ {dependencyUpdate.commandResult.command}</code>
            <div><span>EXIT {dependencyUpdate.commandResult.exitCode}</span><span>{dependencyUpdate.commandResult.durationMs} MS</span><span>{dependencyUpdate.commandResult.outputTruncated ? "OUTPUT BOUNDED" : "OUTPUT COMPLETE"}</span></div>
            {dependencyUpdate.commandResult.stdout && <pre>{dependencyUpdate.commandResult.stdout}</pre>}
          </div>

          <div className="dependency-grid">
            <article>
              <p className="panel-label"><span>01</span> VERSION PROOF</p>
              <dl>
                <div><dt>package.json</dt><dd>{dependencyUpdate.packageName} {dependencyUpdate.manifestVersion}</dd></div>
                <div><dt>package-lock.json</dt><dd>{dependencyUpdate.packageName} {dependencyUpdate.lockfileVersion}</dd></div>
              </dl>
              <div className="changed-file-list">{dependencyUpdate.changedFiles.map((file) => <code key={file}>◇ {file}</code>)}</div>
            </article>
            <article className="diff-panel">
              <p className="panel-label"><span>02</span> PRESERVED DEPENDENCY DIFF</p>
              <pre>{dependencyUpdate.diff}</pre>
            </article>
          </div>

          <div className="dependency-checkpoint">
            <div className="ready-icon">✓</div>
            <div><strong>Dependency checkpoint complete.</strong><span>json5 reached the approved fix in both files. Source compatibility repair and regression testing are the next separately reviewed steps.</span></div>
            <code>{dependencyUpdate.completedAt}</code>
          </div>
          {!compatibilityRepair && <div className="repair-launch">
            <div><strong>Dependency checkpoint passed.</strong><span>Ask GPT‑5.6 for one exact source-function replacement, then validate syntax. Maximum two attempts.</span></div>
            <button onClick={repairCompatibility} disabled={status === "repairing"}>
              {status === "repairing" ? "Applying bounded repair…" : "Repair source compatibility"}<span>→</span>
            </button>
          </div>}
          {error && <div className="decision-error">{error}</div>}
        </section>}

        {compatibilityRepair && <section className={`compatibility-repair ${compatibilityRepair.status}`} aria-live="polite">
          <div className="repair-title">
            <div><p className="eyebrow">06 · BOUNDED COMPATIBILITY REPAIR</p><h2>One function. No wandering.</h2></div>
            <div className={`source-badge ${compatibilityRepair.attempts[0]?.proposalRun.source === "openai" ? "live" : "cached"}`}>
              <span>{compatibilityRepair.attempts[0]?.proposalRun.source === "openai" ? "LIVE OPENAI" : "CACHED CONTRACT FIXTURE"}</span>
              <strong>GPT‑5.6 · MAX 2 ATTEMPTS</strong>
            </div>
          </div>

          <div className="repair-facts">
            <div><span>FILE</span><code>{compatibilityRepair.file}</code></div>
            <div><span>ATTEMPTS</span><strong>{compatibilityRepair.attempts.length} / 2</strong></div>
            <div><span>SYNTAX PROBE</span><strong className={compatibilityRepair.status === "repaired" ? "passed" : "failed"}>{compatibilityRepair.status === "repaired" ? "✓ PASSED" : "× STOPPED"}</strong></div>
            <div><span>SOURCE CHECKOUT</span><strong className="passed">✓ CLEAN</strong></div>
          </div>

          <div className="repair-grid">
            <article>
              <p className="panel-label"><span>01</span> ATTEMPT AUDIT</p>
              <ol className="repair-attempts">{compatibilityRepair.attempts.map((attempt) => <li key={attempt.attempt}>
                <span>{attempt.status === "applied_passed" ? "✓" : "×"}</span>
                <div><strong>Attempt {attempt.attempt} · {sentenceCase(attempt.status)}</strong><p>{attempt.proposalRun.proposal.explanation}</p><code>{attempt.probe?.command ?? "No command executed"}</code></div>
              </li>)}</ol>
              <div className="repair-boundary"><strong>Exact replacement only</strong><span>No tests, imports, dependencies, or unrelated files were generated.</span></div>
            </article>
            <article className="source-diff-panel">
              <p className="panel-label"><span>02</span> PRESERVED SOURCE DIFF</p>
              <pre>{compatibilityRepair.sourceDiff || "No source diff retained; the pre-repair file was restored."}</pre>
            </article>
          </div>

          <div className="repair-notes">
            <div><p className="panel-label"><span>!</span> COMPATIBILITY RISKS</p><ul>{compatibilityRepair.attempts.at(-1)?.proposalRun.proposal.compatibilityRisks.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="panel-label"><span>?</span> REMAINING UNKNOWNS</p><ul>{compatibilityRepair.attempts.at(-1)?.proposalRun.proposal.remainingUnknowns.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>

          <div className="repair-checkpoint">
            <div className="ready-icon">{compatibilityRepair.status === "repaired" ? "✓" : "×"}</div>
            <div><strong>{compatibilityRepair.status === "repaired" ? "Source repair checkpoint complete." : "Repair stopped safely."}</strong><span>{compatibilityRepair.status === "repaired" ? "The approved function changed and syntax passes. One safe targeted test is the next separately gated action; no full verification claim is made yet." : compatibilityRepair.status === "failed_after_two_attempts" ? "Two failed attempts cannot continue silently. The original source was restored and the dependency diff remains reviewable." : "The model classified the failure as unrelated or insufficiently supported. No source diff was retained; the dependency update remains reviewable."}</span></div>
            <code>{compatibilityRepair.completedAt}</code>
          </div>
          {compatibilityRepair.status === "repaired" && !targetedTest && <div className="test-launch">
            <div><strong>Repair checkpoint passed.</strong><span>Generate one benign allowlist regression test, then run only that test file.</span></div>
            <button onClick={generateRegressionTest} disabled={status === "testing"}>
              {status === "testing" ? "Generating and running test…" : "Add targeted regression test"}<span>→</span>
            </button>
          </div>}
          {error && <div className="decision-error">{error}</div>}
        </section>}

        {targetedTest && <section className={`targeted-test ${targetedTest.status}`} aria-live="polite">
          <div className="test-title">
            <div><p className="eyebrow">07 · TARGETED REGRESSION TEST</p><h2>One test. Benign input.</h2></div>
            <div className={`source-badge ${targetedTest.proposalRun.source === "openai" ? "live" : "cached"}`}>
              <span>{targetedTest.proposalRun.source === "openai" ? "LIVE OPENAI" : "CACHED CONTRACT FIXTURE"}</span>
              <strong>GPT‑5.6 · EXACTLY 1 TEST</strong>
            </div>
          </div>

          <div className="test-facts">
            <div><span>FILE</span><code>{targetedTest.file}</code></div>
            <div><span>TESTS ADDED</span><strong>{targetedTest.status === "test_added_passed" ? "1" : "0"}</strong></div>
            <div><span>TARGETED COMMAND</span><strong className={targetedTest.commandResult?.passed ? "passed" : "failed"}>{targetedTest.commandResult?.passed ? "✓ PASSED" : "× STOPPED"}</strong></div>
            <div><span>SOURCE CHECKOUT</span><strong className="passed">✓ CLEAN</strong></div>
          </div>

          <div className="test-grid">
            <article>
              <p className="panel-label"><span>01</span> GENERATED TEST</p>
              <strong className="test-name">{targetedTest.proposalRun.proposal.testName ?? "No test generated"}</strong>
              <p>{targetedTest.proposalRun.proposal.explanation}</p>
              <pre>{targetedTest.proposalRun.proposal.testText ?? "Generation stopped without an edit."}</pre>
              <div className="safe-test-boundary"><strong>Non-weaponized fixture</strong><span>Uses only benign previewLabel: ignored input. Prototype-related keys are rejected before writes.</span></div>
            </article>
            <article>
              <p className="panel-label"><span>02</span> TARGETED COMMAND FACT</p>
              <code className="test-command">$ {targetedTest.commandResult?.command ?? "No command executed"}</code>
              <div className="test-command-meta"><span>EXIT {targetedTest.commandResult?.exitCode ?? "—"}</span><span>{targetedTest.commandResult?.durationMs ?? 0} MS</span><span>{targetedTest.commandResult?.outputTruncated ? "OUTPUT TRUNCATED" : "OUTPUT COMPLETE"}</span></div>
              <pre>{targetedTest.commandResult?.stdout || targetedTest.commandResult?.stderr || "No command output."}</pre>
              <p className="panel-label diff-label"><span>03</span> PRESERVED TEST DIFF</p>
              <pre>{targetedTest.testDiff || "No test diff retained; the original test file was restored."}</pre>
            </article>
          </div>

          <div className="test-notes">
            <div><p className="panel-label"><span>✓</span> SAFETY RATIONALE</p><ul>{targetedTest.proposalRun.proposal.safetyRationale.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="panel-label"><span>?</span> REMAINING UNKNOWNS</p><ul>{targetedTest.proposalRun.proposal.remainingUnknowns.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>

          <div className="test-checkpoint">
            <div className="ready-icon">{targetedTest.status === "test_added_passed" ? "✓" : "×"}</div>
            <div><strong>{targetedTest.status === "test_added_passed" ? "Targeted regression checkpoint complete." : "Targeted test stopped safely."}</strong><span>{targetedTest.status === "test_added_passed" ? "The focused mitigation test passes and its diff is retained. Full tests, build, and rescan remain the next separate verification issue." : targetedTest.status === "test_failed_restored" ? "The focused command failed, so the generated test was restored and no passing claim is made." : "Generation stopped without a test write or command execution."}</span></div>
            <code>{targetedTest.completedAt}</code>
          </div>
          {targetedTest.status === "test_added_passed" && !verification && <div className="verification-launch">
            <div><strong>Four-file checkpoint passed.</strong><span>Compare the vulnerable baseline with the approved patch, then rescan the selected advisory.</span></div>
            <button onClick={runVerification} disabled={status === "verifying"}>
              {status === "verifying" ? "Running verification sequence…" : "Run full verification"}<span>→</span>
            </button>
          </div>}
          {error && <div className="decision-error">{error}</div>}
        </section>}

        {verification && <section className={`verification ${verification.status}`} aria-live="polite">
          <div className="verification-title">
            <div><p className="eyebrow">08 · DETERMINISTIC VERIFICATION</p><h2>Before. After. Gone.</h2></div>
            <div className={`verification-badge ${verification.status}`}><span>GOLDEN-PATH FACTS</span><strong>{verification.status === "verified" ? "✓ VERIFIED" : "× STOPPED"}</strong></div>
          </div>

          <div className="verification-facts">
            <div><span>BASELINE</span><strong className={verification.baseline.fullTestsPassed && verification.baseline.buildPassed ? "passed" : "failed"}>{verification.baseline.fullTestsPassed && verification.baseline.buildPassed ? "✓ PASS" : "× STOP"}</strong></div>
            <div><span>POST-PATCH</span><strong className={verification.postPatch.fullTestsPassed && verification.postPatch.buildPassed ? "passed" : "failed"}>{verification.postPatch.fullTestsPassed && verification.postPatch.buildPassed ? "✓ PASS" : "× STOP"}</strong></div>
            <div><span>SELECTED ADVISORY</span><strong className={verification.rescan && !verification.rescan.selectedAdvisoryPresent ? "passed" : "failed"}>{verification.rescan ? verification.rescan.selectedAdvisoryPresent ? "× PRESENT" : "✓ ABSENT" : "— NOT RUN"}</strong></div>
            <div><span>SOURCE CHECKOUT</span><strong className="passed">✓ CLEAN</strong></div>
          </div>

          <div className="verification-grid">
            <article>
              <p className="panel-label"><span>01</span> COMMAND AUDIT</p>
              <ol className="verification-commands">{verification.commands.map((command, index) => <li key={`${command.phase}-${command.kind}-${index}`}>
                <span className={command.status === "passed" || command.status === "findings_present" ? "passed" : "failed"}>{command.status === "passed" ? "✓" : command.status === "findings_present" ? "!" : "×"}</span>
                <div><div><strong>{sentenceCase(command.phase)} · {sentenceCase(command.kind)}</strong><small>EXIT {command.exitCode} · {command.durationMs} MS · {command.outputTruncated ? "TRUNCATED" : "COMPLETE"}</small></div><code>$ {command.command}</code><pre>{[command.stdoutSummary, command.stderrSummary].filter(Boolean).join("\n") || "Command completed without output."}</pre></div>
              </li>)}</ol>
            </article>
            <article>
              <p className="panel-label"><span>02</span> RESCAN PROOF</p>
              {verification.rescan ? <div className="rescan-proof">
                <div><span>SCANNER</span><strong>OSV-Scanner {verification.rescan.scannerVersion}</strong></div>
                <div><span>NORMALIZED FINDINGS</span><strong>{verification.rescan.findingCount}</strong></div>
                <div><span>SELECTED</span><code>{verification.selectedAdvisoryId}</code></div>
                <div className="advisory-gone"><span>✓</span><div><strong>{verification.rescan.selectedAdvisoryPresent ? "Selected advisory remains" : "Selected advisory disappeared"}</strong><p>{verification.rescan.selectedAdvisoryPresent ? "Verification fails closed; no clean claim is made." : "The normalized post-patch OSV result no longer contains the selected vulnerability."}</p></div></div>
              </div> : <div className="rescan-not-run"><strong>Rescan not reached.</strong><span>An earlier deterministic command failed, so the workflow stopped honestly.</span></div>}
              <p className="panel-label failure-label"><span>{verification.failure ? "!" : "✓"}</span> FAILURE CLASSIFICATION</p>
              <div className={`verification-classification ${verification.failure ? "failed" : "passed"}`}><strong>{verification.failure ? sentenceCase(verification.failure.classification) : "none — verification passed"}</strong><span>{verification.failure?.summary ?? "All baseline, post-patch, and selected-advisory checks passed."}</span></div>
            </article>
          </div>

          <div className="verification-checkpoint">
            <div className="ready-icon">{verification.status === "verified" ? "✓" : "×"}</div>
            <div><strong>{verification.status === "verified" ? "Verification checkpoint complete." : "Verification stopped honestly."}</strong><span>{verification.status === "verified" ? "Baseline and post-patch tests/build pass, the selected advisory is absent, and the approved four-file diff remains intact. The accepted chain is ready for reporting." : "The failure classification and bounded command facts are retained; reporting and publication remain blocked."}</span></div>
            <code>{verification.completedAt}</code>
          </div>
          {verification.status === "verified" && !evidenceReport && <div className="report-launch">
            <div><strong>Verification chain accepted.</strong><span>Freeze the finding, evidence, approval, patch, commands, rescan, and uncertainty into two reviewable artifacts.</span></div>
            <button onClick={generateReport} disabled={status === "reporting"}>
              {status === "reporting" ? "Generating evidence artifacts…" : "Generate evidence report"}<span>→</span>
            </button>
          </div>}
          </section>}

        {evidenceReport && <section className="evidence-report" aria-live="polite">
          <div className="report-title">
            <div><p className="eyebrow">09 · HUMAN-REVIEWABLE EVIDENCE</p><h2>Facts. Judgment. Approval. Unknowns.</h2></div>
            <div className="report-badge"><span>MARKDOWN + JSON</span><strong>✓ REPORT READY</strong></div>
          </div>

          <div className="report-facts">
            <div><span>FINAL STATUS</span><strong>✓ {evidenceReport.report.finalStatus.status.toUpperCase()}</strong></div>
            <div><span>EVIDENCE REFERENCES</span><strong>{evidenceReport.report.deterministicFacts.evidence.length} VALID</strong></div>
            <div><span>COMMAND FACTS</span><strong>{evidenceReport.report.deterministicFacts.commands.length}</strong></div>
            <div><span>SELECTED ADVISORY</span><strong>✓ ABSENT</strong></div>
          </div>

          <div className="report-grid">
            <article>
              <p className="panel-label"><span>F</span> DETERMINISTIC FACTS</p>
              <ul>
                <li>Original {evidenceReport.report.deterministicFacts.finding.id} finding</li>
                <li>Repository-relative evidence and line references</li>
                <li>Exact four-file patch and command results</li>
                <li>Normalized OSV rescan with selected advisory absent</li>
              </ul>
            </article>
            <article className="interpretation-card">
              <p className="panel-label"><span>AI</span> MODEL INTERPRETATION</p>
              <strong>{sentenceCase(evidenceReport.report.modelInterpretation.affectedness.assessment.verdict)} · {evidenceReport.report.modelInterpretation.affectedness.assessment.confidence} confidence</strong>
              <p>{evidenceReport.report.modelInterpretation.affectedness.assessment.rationale}</p>
            </article>
            <article className="uncertainty-card">
              <p className="panel-label"><span>?</span> UNCERTAINTY RETAINED</p>
              <ul>{evidenceReport.report.uncertainty.affectednessUnknowns.map((item) => <li key={item}>{item}</li>)}</ul>
              <small>{evidenceReport.report.uncertainty.disclaimer}</small>
            </article>
          </div>

          <div className="report-artifacts">
            <div><span>MARKDOWN</span><code>{evidenceReport.reportPaths.markdown}</code></div>
            <div><span>JSON</span><code>{evidenceReport.reportPaths.json}</code></div>
            <div className="report-actions">
              <a href={`/api/demo/report/${evidenceReport.runId}.md`} download>Download .md</a>
              <a href={`/api/demo/report/${evidenceReport.runId}.json`} download>Download .json</a>
              <button className="secondary" onClick={copyMarkdown}>{copyLabel}</button>
            </div>
          </div>

          <details className="report-preview"><summary>Preview Markdown evidence report</summary><pre>{evidenceReport.markdown}</pre></details>
          <div className="report-checkpoint">
            <div className="ready-icon">✓</div>
            <div><strong>Golden path complete.</strong><span>Detect → investigate → approve → patch → test → rescan → report. A local review handoff is available; remote publication remains separate.</span></div>
            <code>{evidenceReport.completedAt}</code>
          </div>
          {!gitHandoff && <div className="handoff-launch">
            <div><strong>Evidence accepted for local handoff.</strong><span>Commit exactly the verified four-file patch and prepare accurate draft-PR copy. This does not push or open a pull request.</span></div>
            <button onClick={createLocalHandoff} disabled={status === "handing_off"}>
              {status === "handing_off" ? "Creating verified local commit…" : "Create local commit + PR copy"}<span>→</span>
            </button>
          </div>}
          {error && <div className="decision-error">{error}</div>}
        </section>}

        {gitHandoff && <section className="git-handoff" aria-live="polite">
          <div className="handoff-title">
            <div><p className="eyebrow">10 · REVIEW-READY GIT HANDOFF</p><h2>Committed locally. Publication locked.</h2></div>
            <div className="handoff-badge"><span>LOCAL BRANCH</span><strong>✓ COMMIT READY</strong></div>
          </div>

          <div className="handoff-facts">
            <div><span>BRANCH</span><code>{gitHandoff.commit.branchName}</code></div>
            <div><span>COMMIT</span><code>{gitHandoff.commit.sha.slice(0, 12)}</code></div>
            <div><span>FILES</span><strong>{gitHandoff.commit.changedFiles.length} EXACT</strong></div>
            <div><span>REMOTE</span><strong className="locked">LOCKED · NOT REQUESTED</strong></div>
          </div>

          <div className="handoff-grid">
            <article>
              <p className="panel-label"><span>01</span> LOCAL COMMIT</p>
              <strong className="commit-message">{gitHandoff.commit.message}</strong>
              <dl>
                <div><dt>Parent</dt><dd><code>{gitHandoff.commit.parent.slice(0, 12)}</code></dd></div>
                <div><dt>Source checkout</dt><dd>clean</dd></div>
                <div><dt>Audit</dt><dd><code>{gitHandoff.resultLogPath}</code></dd></div>
              </dl>
              <div className="changed-file-list">{gitHandoff.commit.changedFiles.map((file) => <code key={file}>◇ {file}</code>)}</div>
            </article>
            <article className="pr-copy-card">
              <p className="panel-label"><span>02</span> DRAFT PR COPY</p>
              <strong>{gitHandoff.pullRequestDraft.title}</strong>
              <pre>{gitHandoff.pullRequestDraft.body}</pre>
              <button className="secondary" onClick={copyPullRequestBody}>{prCopyLabel}</button>
            </article>
          </div>

          <div className="publication-lock">
            <span>⌁</span>
            <div><strong>Remote publication requires a new explicit approval.</strong><p>{gitHandoff.remotePublication.reason} No push, pull request, or merge command ran.</p></div>
          </div>
          <div className="handoff-checkpoint">
            <div className="ready-icon">✓</div>
            <div><strong>Review-ready local handoff complete.</strong><span>The verified patch is committed and its draft-PR title, evidence, tests, model contribution, and limitations are ready for a maintainer.</span></div>
            <code>{gitHandoff.completedAt}</code>
          </div>
        </section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
