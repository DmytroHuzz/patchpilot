#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
"${script_dir}/reset-demo.sh"
npm ci --prefix "${script_dir}/vulnerable-node-app"
npm test --prefix "${script_dir}/vulnerable-node-app"

echo "PatchPilot launch is added after the Milestone 1 scanner UI passes."

