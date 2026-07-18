#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
demo_repo="${script_dir}/vulnerable-node-app"

if [[ ! -d "${demo_repo}" || -L "${demo_repo}" ]]; then
  echo "Refusing to reset: expected a non-symlink demo directory at ${demo_repo}" >&2
  exit 1
fi

if [[ ! -d "${demo_repo}/.git" ]]; then
  git -C "${demo_repo}" init -q -b main
  git -C "${demo_repo}" add .
  git -C "${demo_repo}" \
    -c user.name="PatchPilot Demo" \
    -c user.email="demo@patchpilot.local" \
    commit -q -m "fixture: vulnerable baseline"
  git -C "${demo_repo}" tag vulnerable
fi

if ! git -C "${demo_repo}" rev-parse --verify --quiet "refs/tags/vulnerable" >/dev/null; then
  echo "Refusing to reset: the demo repository has no vulnerable tag" >&2
  exit 1
fi

git -C "${demo_repo}" reset --hard -q vulnerable
git -C "${demo_repo}" clean -fdx -q

echo "Reset demo repository to vulnerable tag: ${demo_repo}"

