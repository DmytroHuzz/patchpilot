import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NormalizedScanResultSchema, type NormalizedScanResult } from "@patchpilot/contracts";
import { normalizeOsvOutput } from "./normalizeOsv.js";

const execFileAsync = promisify(execFile);

export interface ScanOptions {
  repositoryPath: string;
  scannerPath?: string;
  timeoutMs?: number;
}

export async function scannerVersion(scannerPath: string): Promise<string> {
  const { stdout } = await execFileAsync(scannerPath, ["--version"], { timeout: 5_000, maxBuffer: 64 * 1024 });
  const match = stdout.match(/osv-scanner version:\s*([^\s]+)/);
  if (!match?.[1]) throw new Error("Could not determine OSV-Scanner version");
  return match[1];
}

export async function scanRepository(options: ScanOptions): Promise<NormalizedScanResult> {
  const repositoryPath = await realpath(options.repositoryPath);
  const manifestPath = path.join(repositoryPath, "package.json");
  const lockfilePath = path.join(repositoryPath, "package-lock.json");
  await Promise.all([readFile(manifestPath, "utf8"), readFile(lockfilePath, "utf8")]);

  const scannerPath = options.scannerPath ?? process.env.OSV_SCANNER_PATH ?? path.join(process.cwd(), "tools/bin/osv-scanner");
  const args = ["scan", "source", "--format", "json", "--verbosity", "error", repositoryPath];
  let stdout: string;

  try {
    ({ stdout } = await execFileAsync(scannerPath, args, {
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: 5 * 1024 * 1024,
    }));
  } catch (error) {
    const scanError = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    if (scanError.code !== 1 || !scanError.stdout) {
      throw new Error(`OSV-Scanner failed: ${scanError.stderr?.trim() || scanError.message}`);
    }
    stdout = scanError.stdout;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch {
    throw new Error("OSV-Scanner returned malformed JSON");
  }

  return NormalizedScanResultSchema.parse({
    scanner: "osv-scanner",
    scannerVersion: await scannerVersion(scannerPath),
    repositoryPath,
    scannedAt: new Date().toISOString(),
    findings: normalizeOsvOutput(raw, repositoryPath),
  });
}
