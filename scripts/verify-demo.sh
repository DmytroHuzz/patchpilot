#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "${repo_root}"

./scripts/setup-osv-scanner.sh
./demo/reset-demo.sh
npm ci --prefix demo/vulnerable-node-app --ignore-scripts
npm test --prefix demo/vulnerable-node-app
npm run build --prefix demo/vulnerable-node-app
npm run scan:demo > /dev/null

node -e '
  const result = require("./runs/m1-scan.json");
  const finding = result.findings.find(({ id }) => id === "GHSA-9c47-m6qq-7p4h");
  if (!finding || finding.packageName !== "json5" || finding.installedVersion !== "1.0.1") process.exit(1);
  console.log(`Milestone 1 passed: ${finding.id} in ${finding.packageName}@${finding.installedVersion}`);
'
