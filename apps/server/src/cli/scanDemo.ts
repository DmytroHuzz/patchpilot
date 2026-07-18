import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { scanRepository } from "../scanning/osvScanner.js";

const root = process.cwd();
const result = await scanRepository({ repositoryPath: path.join(root, "demo/vulnerable-node-app") });
const expected = result.findings.find((finding) => finding.id === "GHSA-9c47-m6qq-7p4h");

if (!expected) {
  throw new Error("Milestone 1 failed: expected GHSA-9c47-m6qq-7p4h was not detected");
}

await mkdir(path.join(root, "runs"), { recursive: true });
await writeFile(path.join(root, "runs/m1-scan.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

