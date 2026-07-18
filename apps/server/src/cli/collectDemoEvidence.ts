import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCachedAdvisory } from "../advisory/resolveAdvisory.js";
import { collectRepositoryEvidence } from "../repository/collectEvidence.js";
import { scanRepository } from "../scanning/osvScanner.js";

const expectedId = "GHSA-9c47-m6qq-7p4h";
const root = process.cwd();
const repositoryPath = path.join(root, "demo/vulnerable-node-app");
const scan = await scanRepository({ repositoryPath });
const finding = scan.findings.find(({ id }) => id === expectedId);
if (!finding) throw new Error(`Evidence collection failed: ${expectedId} was not detected`);

const advisory = await loadCachedAdvisory(expectedId, path.join(root, "demo/cached-advisories"));
const evidence = await collectRepositoryEvidence({ repositoryPath, finding, advisory });
const expectedCall = evidence.items.find((item) =>
  item.type === "call-site" && item.file === "src/theme.js" && item.excerpt?.includes("JSON5.parse(rawTheme)"),
);
if (!expectedCall) throw new Error("Evidence collection failed: expected JSON5.parse call site was not found");

await mkdir(path.join(root, "runs"), { recursive: true });
await writeFile(path.join(root, "runs/m2-evidence.json"), `${JSON.stringify({ advisory, evidence }, null, 2)}\n`);
console.log(JSON.stringify({ advisory, evidence }, null, 2));
