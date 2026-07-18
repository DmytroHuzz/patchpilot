#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/.." && pwd -P)"
"${script_dir}/reset-demo.sh"
npm ci --prefix "${script_dir}/vulnerable-node-app"
npm test --prefix "${script_dir}/vulnerable-node-app"
npm run build --prefix "${script_dir}/vulnerable-node-app"
"${repo_root}/scripts/setup-osv-scanner.sh"

cd "${repo_root}"
exec npm run demo
