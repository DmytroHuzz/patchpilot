import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  RepositoryEvidenceBundleSchema,
  type EvidenceItem,
  type NormalizedAdvisory,
  type RepositoryEvidenceBundle,
  type VulnerabilityFinding,
} from "@patchpilot/contracts";

export interface EvidenceLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxEvidenceItems: number;
  contextLines: number;
}

export interface CollectEvidenceOptions {
  repositoryPath: string;
  finding: VulnerabilityFinding;
  advisory: NormalizedAdvisory;
  limits?: Partial<EvidenceLimits>;
}

const defaultLimits: EvidenceLimits = {
  maxFiles: 200,
  maxFileBytes: 128 * 1024,
  maxTotalBytes: 1024 * 1024,
  maxEvidenceItems: 24,
  contextLines: 1,
};
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", ".cache"]);
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".json", ".mjs", ".ts", ".tsx"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRepositoryPath(repositoryPath: string, filePath: string): string {
  return path.relative(repositoryPath, filePath).split(path.sep).join("/");
}

async function discoverFiles(repositoryPath: string, limits: EvidenceLimits): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  let truncated = false;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (files.length >= limits.maxFiles) {
        truncated = true;
        return;
      }
      if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name)) && entry.name !== "package-lock.json") {
        files.push(entryPath);
      }
    }
  }

  await visit(repositoryPath);
  return { files, truncated };
}

function advisorySearchTerms(advisory: NormalizedAdvisory): { symbols: string[]; configurationKeys: string[] } {
  const text = `${advisory.summary}\n${advisory.details}`;
  const symbols = new Set(advisory.affectedFunctions.map((value) => value.split(".").at(-1)!).filter(Boolean));
  const configurationKeys = new Set<string>();

  for (const match of text.matchAll(/`?([A-Za-z_$][\w$]*)`?\s+method\b/gi)) {
    if (match[1]) symbols.add(match[1]);
  }
  for (const match of text.matchAll(/`([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)`/g)) {
    const token = match[1];
    if (!token) continue;
    if (token.includes(".")) symbols.add(token.split(".").at(-1)!);
    else if (token.startsWith("_") || token.includes("-")) configurationKeys.add(token);
  }

  return { symbols: [...symbols].sort(), configurationKeys: [...configurationKeys].sort() };
}

function excerpt(lines: string[], matchLine: number, contextLines: number): Pick<EvidenceItem, "startLine" | "endLine" | "excerpt"> {
  const startIndex = Math.max(0, matchLine - 1 - contextLines);
  const endIndex = Math.min(lines.length - 1, matchLine - 1 + contextLines);
  return {
    startLine: startIndex + 1,
    endLine: endIndex + 1,
    excerpt: lines.slice(startIndex, endIndex + 1).join("\n"),
  };
}

function importBindings(content: string, packageName: string): { bindings: string[]; importLines: number[] } {
  const escapedPackage = escapeRegExp(packageName);
  const patterns = [
    new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*require\\(\\s*["']${escapedPackage}["']\\s*\\)`),
    new RegExp(`import\\s+([A-Za-z_$][\\w$]*)\\s+from\\s+["']${escapedPackage}["']`),
    new RegExp(`import\\s+\\*\\s+as\\s+([A-Za-z_$][\\w$]*)\\s+from\\s+["']${escapedPackage}["']`),
  ];
  const lines = content.split(/\r?\n/);
  const bindings = new Set<string>();
  const importLines: number[] = [];

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        bindings.add(match[1]);
        importLines.push(index + 1);
      }
    }
  });

  return { bindings: [...bindings], importLines: [...new Set(importLines)] };
}

export async function collectRepositoryEvidence(options: CollectEvidenceOptions): Promise<RepositoryEvidenceBundle> {
  const repositoryPath = await realpath(options.repositoryPath);
  const limits = { ...defaultLimits, ...options.limits };
  const discovered = await discoverFiles(repositoryPath, limits);
  const searchTerms = advisorySearchTerms(options.advisory);
  const items: EvidenceItem[] = [];
  const searchedFiles: string[] = [];
  let searchedBytes = 0;
  let truncated = discovered.truncated;
  const configurationMatches = new Set<string>();

  function add(item: Omit<EvidenceItem, "id">): void {
    if (items.length >= limits.maxEvidenceItems) {
      truncated = true;
      return;
    }
    items.push({ ...item, id: `evidence-${String(items.length + 1).padStart(2, "0")}` });
  }

  for (const filePath of discovered.files) {
    const fileStat = await stat(filePath);
    if (fileStat.size > limits.maxFileBytes || searchedBytes + fileStat.size > limits.maxTotalBytes) {
      truncated = true;
      continue;
    }

    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const file = toRepositoryPath(repositoryPath, filePath);
    searchedFiles.push(file);
    searchedBytes += fileStat.size;
    const imports = importBindings(content, options.finding.packageName);

    for (const lineNumber of imports.importLines) {
      add({
        type: "import",
        file,
        ...excerpt(lines, lineNumber, 0),
        explanation: `${options.finding.packageName} is imported into this source file.`,
        deterministic: true,
      });
    }

    for (const binding of imports.bindings) {
      for (const symbol of searchTerms.symbols) {
        const callPattern = new RegExp(`\\b${escapeRegExp(binding)}\\.${escapeRegExp(symbol)}\\s*\\(`);
        lines.forEach((line, index) => {
          if (!callPattern.test(line)) return;
          add({
            type: "call-site",
            file,
            ...excerpt(lines, index + 1, limits.contextLines),
            explanation: `Calls advisory-relevant symbol ${binding}.${symbol}.`,
            deterministic: true,
          });
        });
      }
    }

    for (const key of searchTerms.configurationKeys) {
      lines.forEach((line, index) => {
        if (!line.includes(key)) return;
        configurationMatches.add(key);
        add({
          type: "configuration",
          file,
          ...excerpt(lines, index + 1, limits.contextLines),
          explanation: `References advisory-mentioned configuration key ${key}.`,
          deterministic: true,
        });
      });
    }
  }

  for (const key of searchTerms.configurationKeys) {
    if (configurationMatches.has(key)) continue;
    add({
      type: "absence",
      explanation: `Searched ${searchedFiles.length} bounded repository files and found no source reference to advisory-mentioned key ${key}. Absence is not proof of non-applicability.`,
      deterministic: true,
    });
  }

  return RepositoryEvidenceBundleSchema.parse({
    repositoryPath,
    findingId: options.finding.id,
    searchedFiles,
    searchedBytes,
    truncated,
    items,
  });
}
