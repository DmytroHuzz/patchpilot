#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [narrationPath, outputDirectory] = process.argv.slice(2);

if (!narrationPath || !outputDirectory) {
  throw new Error("Usage: generate-demo-narration.mjs <narration.txt> <output-directory>");
}

const paragraphs = readFileSync(narrationPath, "utf8")
  .trim()
  .split(/\n\s*\n/u)
  .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
  .filter(Boolean);

if (paragraphs.length !== 9) {
  throw new Error(`Expected exactly 9 narration paragraphs, received ${paragraphs.length}`);
}

mkdirSync(outputDirectory, { recursive: true });

const edgeTts = process.env.PATCHPILOT_EDGE_TTS_BIN?.trim();
const provider = edgeTts ? "edge-tts" : "macos-say";
const extension = edgeTts ? "mp3" : "aiff";
const voice = edgeTts
  ? process.env.PATCHPILOT_EDGE_TTS_VOICE?.trim() || "en-US-AndrewMultilingualNeural"
  : process.env.PATCHPILOT_VIDEO_VOICE?.trim() || "Reed (English (US))";
const rate = edgeTts
  ? process.env.PATCHPILOT_EDGE_TTS_RATE?.trim() || "-4%"
  : process.env.PATCHPILOT_VIDEO_RATE?.trim() || "165";

const clips = paragraphs.map((paragraph, index) => {
  const filename = `${String(index).padStart(2, "0")}.${extension}`;
  const outputPath = resolve(outputDirectory, filename);
  const result = edgeTts
    ? spawnSync(
        edgeTts,
        [
          "--voice",
          voice,
          `--rate=${rate}`,
          "--text",
          paragraph,
          "--write-media",
          outputPath,
        ],
        { encoding: "utf8" },
      )
    : spawnSync(
        "say",
        ["-v", voice, "-r", rate, paragraph, "-o", outputPath],
        { encoding: "utf8" },
      );

  if (result.status !== 0) {
    throw new Error(
      `Narration clip ${index + 1} failed: ${result.stderr?.trim() || result.stdout?.trim() || "unknown error"}`,
    );
  }

  return filename;
});

const manifest = {
  provider,
  voice,
  rate,
  clips,
};
const manifestPath = resolve(outputDirectory, "manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated ${clips.length} synchronized narration clips with ${provider} (${voice}).`);
console.log(`manifest=${manifestPath}`);
