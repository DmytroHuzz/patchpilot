#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/.." && pwd -P)"
artifact_dir="${repo_root}/submission/artifacts"
narration_file="${repo_root}/submission/video-narration.txt"
narration_dir="${artifact_dir}/narration-clips"
narration_manifest="${narration_dir}/manifest.json"
output_file="${artifact_dir}/patchpilot-demo.mp4"
renderer_bin="${artifact_dir}/render-demo-video"

mkdir -p "${artifact_dir}"

node "${script_dir}/generate-demo-narration.mjs" "${narration_file}" "${narration_dir}"
swiftc -parse-as-library "${script_dir}/render-demo-video.swift" -o "${renderer_bin}"
"${renderer_bin}" "${repo_root}" "${narration_manifest}" "${output_file}"

echo "Rendered PatchPilot review video: ${output_file}"
