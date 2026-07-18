import { readFile } from "node:fs/promises";
import path from "node:path";
import { NormalizedAdvisorySchema, type NormalizedAdvisory } from "@patchpilot/contracts";
import { normalizeOsvAdvisory } from "./normalizeAdvisory.js";

export interface ResolveAdvisoryOptions {
  id: string;
  liveAdvisory?: unknown;
  cacheDirectory: string;
}

export async function loadCachedAdvisory(id: string, cacheDirectory: string): Promise<NormalizedAdvisory> {
  const safeId = id.match(/^[A-Za-z0-9-]+$/)?.[0];
  if (!safeId) throw new Error(`Invalid advisory ID: ${id}`);

  const cacheRoot = path.resolve(cacheDirectory);
  const cachePath = path.resolve(cacheRoot, `${safeId}.json`);
  if (!cachePath.startsWith(`${cacheRoot}${path.sep}`)) throw new Error("Cached advisory path escaped its root");

  const cached = NormalizedAdvisorySchema.parse(JSON.parse(await readFile(cachePath, "utf8")));
  if (cached.id !== id) throw new Error(`Cached advisory ID mismatch: expected ${id}, received ${cached.id}`);
  if (cached.source !== "cached-demo") throw new Error("Cached advisory must be labeled cached-demo");
  return cached;
}

export async function resolveAdvisory(options: ResolveAdvisoryOptions): Promise<NormalizedAdvisory> {
  if (options.liveAdvisory !== undefined) {
    try {
      const live = normalizeOsvAdvisory(options.liveAdvisory);
      if (live.id !== options.id) throw new Error("Live advisory ID mismatch");
      return live;
    } catch {
      // The checked-in fallback is deterministic and explicitly labeled below.
    }
  }

  return loadCachedAdvisory(options.id, options.cacheDirectory);
}
