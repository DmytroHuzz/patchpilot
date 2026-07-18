import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const requiredReadmeHeadings = [
  "The problem",
  "Demo screenshots",
  "Golden workflow",
  "Architecture",
  "How OSV-Scanner is reused",
  "What PatchPilot adds",
  "Supported environment",
  "Installation",
  "Environment variables",
  "Running the bundled demo",
  "Running against another local repository",
  "Running tests",
  "Safety model",
  "Known limitations",
  "Hackathon context",
  "How Codex was used",
  "How GPT-5.6 was used",
  "License and third-party acknowledgements",
  "Roadmap",
];
const requiredArchitectureHeadings = [
  "Component diagram",
  "Workflow state machine",
  "Trust boundaries",
  "Scanner adapter",
  "Model context construction",
  "Approval and patch isolation",
  "Verification flow",
  "Report generation",
];
const requiredSecurityHeadings = [
  "Commands that may execute",
  "Repository and path restrictions",
  "Human approval boundary",
  "Log redaction",
  "Verification claims",
];
const requiredDemoHeadings = [
  "Acceptance contract",
  "Recording preflight",
  "Timed storyboard",
  "Exact click order",
  "Reset between takes",
  "Fallback plan",
  "Fallback assets",
  "Rehearsal evidence",
];

function assertHeadings(file, headings) {
  const contents = read(file);
  const missing = headings.filter((heading) => !contents.includes(`## ${heading}\n`));
  if (missing.length > 0) throw new Error(`${file} is missing required headings: ${missing.join(", ")}`);
}

assertHeadings("README.md", requiredReadmeHeadings);
assertHeadings("docs/architecture.md", requiredArchitectureHeadings);
assertHeadings("docs/security-model.md", requiredSecurityHeadings);
assertHeadings("docs/demo-script.md", requiredDemoHeadings);

const demoScript = read("docs/demo-script.md");
for (const action of [
  "Run deterministic scan",
  "Investigate affectedness",
  "Review remediation plan",
  "Approve this exact plan",
  "Create isolated workspace",
  "Apply approved dependency update",
  "Repair source compatibility",
  "Add targeted regression test",
  "Run full verification",
  "Generate evidence report",
  "Create local commit + PR copy",
]) {
  if (!demoScript.includes(`**${action}**`)) throw new Error(`Demo script is missing exact action: ${action}`);
}
if (demoScript.includes("| Pending")) throw new Error("Demo rehearsal evidence is still pending");

const markdownFiles = [
  "README.md",
  "CONTRIBUTING.md",
  ...readdirSync(path.join(root, "docs"), { recursive: true })
    .filter((file) => typeof file === "string" && file.endsWith(".md"))
    .map((file) => path.join("docs", file)),
];
const brokenLinks = [];
for (const file of markdownFiles) {
  const contents = read(file);
  for (const match of contents.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(target));
    if (!existsSync(resolved)) brokenLinks.push(`${file} -> ${target}`);
  }
}
if (brokenLinks.length > 0) throw new Error(`Broken local documentation links:\n${brokenLinks.join("\n")}`);

for (const screenshot of ["docs/assets/patchpilot-investigation.jpg", "docs/assets/patchpilot-handoff.jpg"]) {
  if (!existsSync(path.join(root, screenshot))) throw new Error(`Required screenshot is missing: ${screenshot}`);
}

console.log(`Documentation contract passed: ${requiredReadmeHeadings.length + 1} README requirements, diagrams, safety sections, demo runbook, screenshots, and local links.`);
