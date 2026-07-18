#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/.." && pwd -P)"
artifact_dir="${repo_root}/submission/artifacts"
narration_file="${repo_root}/submission/video-narration.txt"
audio_file="${artifact_dir}/patchpilot-narration.aiff"
output_file="${artifact_dir}/patchpilot-demo.mp4"
renderer_bin="${artifact_dir}/render-demo-video"

mkdir -p "${artifact_dir}"

voice="${PATCHPILOT_VIDEO_VOICE:-Reed (English (US))}"
rate="${PATCHPILOT_VIDEO_RATE:-165}"

say -v "${voice}" -r "${rate}" -f "${narration_file}" -o "${audio_file}"
swiftc -parse-as-library "${script_dir}/render-demo-video.swift" -o "${renderer_bin}"
"${renderer_bin}" "${repo_root}" "${audio_file}" "${output_file}"

echo "Rendered PatchPilot review video: ${output_file}"
