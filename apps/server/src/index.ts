import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import path from "node:path";
import {
  CompatibilityRepairRequestSchema,
  DependencyUpdateRequestSchema,
  IsolationRequestSchema,
  RemediationDecisionRequestSchema,
  TargetedTestRequestSchema,
} from "@patchpilot/contracts";
import { investigateRepository } from "./investigation/investigateRepository.js";
import { RemediationApprovalStore } from "./remediation/approvalGate.js";
import { createRemediationProposal } from "./remediation/createRemediationProposal.js";
import { createIsolatedGitWorkspace, IsolationRunStore } from "./remediation/isolateRepository.js";
import { applyApprovedDependencyUpdate, DependencyUpdateStore } from "./remediation/updateDependency.js";
import { CompatibilityRepairStore, runCompatibilityRepairLoop } from "./remediation/repairCompatibilityLoop.js";
import { generateTargetedRegressionTest, TargetedTestStore } from "./remediation/generateTargetedRegressionTest.js";
import { scanRepository } from "./scanning/osvScanner.js";

export const serviceName = "PatchPilot orchestrator";
const root = process.cwd();
const webRoot = path.join(root, "apps/web/dist");
const demoRoot = path.join(root, "demo/vulnerable-node-app");
const port = Number(process.env.PORT ?? 4173);
const approvalStore = new RemediationApprovalStore();
const isolationRunStore = new IsolationRunStore();
const dependencyUpdateStore = new DependencyUpdateStore();
const compatibilityRepairStore = new CompatibilityRepairStore();
const targetedTestStore = new TargetedTestStore();

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function readJsonBody(request: IncomingMessage, maxBytes = 8 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new Error("Request body exceeds the 8 KiB limit");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/demo/scan") {
    try {
      const result = await scanRepository({ repositoryPath: demoRoot });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Scan failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/investigate") {
    try {
      const result = await investigateRepository({ repositoryPath: demoRoot, projectRoot: root });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Investigation failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/remediation-plan") {
    try {
      const proposal = await createRemediationProposal({
        repositoryPath: demoRoot,
        projectRoot: root,
        approvalStore,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(proposal));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Planning failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/remediation-decision") {
    try {
      const decision = RemediationDecisionRequestSchema.parse(await readJsonBody(request));
      const proposal = approvalStore.decide(decision);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(proposal));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Decision failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/isolate") {
    try {
      const isolationRequest = IsolationRequestSchema.parse(await readJsonBody(request));
      const existing = isolationRunStore.getByPlan(isolationRequest.planId);
      if (existing) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(existing));
        return;
      }
      const proposal = approvalStore.get(isolationRequest.planId);
      if (!proposal) throw new Error("Approved remediation proposal is unknown or expired");
      const run = await createIsolatedGitWorkspace({
        proposal,
        repositoryPath: demoRoot,
        boundaryRoot: root,
        worktreeRoot: path.join(root, "runs/worktrees"),
        auditRoot: path.join(root, "runs/audit"),
      });
      const stored = isolationRunStore.register(run);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(stored));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Isolation failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/dependency-update") {
    try {
      const updateRequest = DependencyUpdateRequestSchema.parse(await readJsonBody(request));
      const existing = dependencyUpdateStore.getByRun(updateRequest.runId);
      if (existing) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(existing));
        return;
      }
      const proposal = approvalStore.get(updateRequest.planId);
      if (!proposal) throw new Error("Approved remediation proposal is unknown or expired");
      const isolationRun = isolationRunStore.getById(updateRequest.runId);
      if (!isolationRun || isolationRun.planId !== updateRequest.planId) {
        throw new Error("Ready isolation run is unknown or does not match the approved plan");
      }
      const result = await applyApprovedDependencyUpdate({
        proposal,
        isolationRun,
        boundaryRoot: root,
        resultRoot: path.join(root, "runs/audit"),
      });
      const stored = dependencyUpdateStore.register(result);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(stored));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Dependency update failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/compatibility-repair") {
    try {
      const repairRequest = CompatibilityRepairRequestSchema.parse(await readJsonBody(request));
      const existing = compatibilityRepairStore.getByRun(repairRequest.runId);
      if (existing) {
        if (existing.planId !== repairRequest.planId) throw new Error("Repair run does not match the requested approved plan");
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(existing));
        return;
      }
      const proposal = approvalStore.get(repairRequest.planId);
      const isolationRun = isolationRunStore.getById(repairRequest.runId);
      const dependencyUpdate = dependencyUpdateStore.getByRun(repairRequest.runId);
      if (!proposal || !isolationRun || !dependencyUpdate) {
        throw new Error("Approved dependency-updated isolation run is unknown or expired");
      }
      const result = await runCompatibilityRepairLoop({
        proposal,
        isolationRun,
        dependencyUpdate,
        boundaryRoot: root,
        resultRoot: path.join(root, "runs/audit"),
        fixturePath: path.join(root, "demo/expected/compatibility-repair.json"),
      });
      const stored = compatibilityRepairStore.register(result);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(stored));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Compatibility repair failed" }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/targeted-test") {
    try {
      const testRequest = TargetedTestRequestSchema.parse(await readJsonBody(request));
      const existing = targetedTestStore.getByRun(testRequest.runId);
      if (existing) {
        if (existing.planId !== testRequest.planId) throw new Error("Targeted test run does not match the requested approved plan");
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(existing));
        return;
      }
      const proposal = approvalStore.get(testRequest.planId);
      const isolationRun = isolationRunStore.getById(testRequest.runId);
      const dependencyUpdate = dependencyUpdateStore.getByRun(testRequest.runId);
      const compatibilityRepair = compatibilityRepairStore.getByRun(testRequest.runId);
      if (!proposal || !isolationRun || !dependencyUpdate || !compatibilityRepair) {
        throw new Error("Approved repaired isolation run is unknown or expired");
      }
      const result = await generateTargetedRegressionTest({
        proposal,
        isolationRun,
        dependencyUpdate,
        compatibilityRepair,
        boundaryRoot: root,
        resultRoot: path.join(root, "runs/audit"),
        fixturePath: path.join(root, "demo/expected/targeted-regression-test.json"),
      });
      const stored = targetedTestStore.register(result);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(stored));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Targeted test generation failed" }));
    }
    return;
  }

  const requestPath = request.url === "/" ? "/index.html" : (request.url ?? "/index.html");
  const filePath = path.resolve(webRoot, `.${requestPath}`);
  if (!filePath.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`PatchPilot Milestone 3 targeted regression test: http://127.0.0.1:${port}`);
});
