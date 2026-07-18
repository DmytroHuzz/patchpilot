#!/usr/bin/env bash
set -euo pipefail

scanner_version="2.3.8"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
bin_dir="${repo_root}/tools/bin"
scanner_path="${bin_dir}/osv-scanner"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) asset="osv-scanner_darwin_arm64" ;;
  Darwin-x86_64) asset="osv-scanner_darwin_amd64" ;;
  Linux-aarch64|Linux-arm64) asset="osv-scanner_linux_arm64" ;;
  Linux-x86_64) asset="osv-scanner_linux_amd64" ;;
  *)
    echo "Unsupported platform: $(uname -s) $(uname -m)" >&2
    exit 1
    ;;
esac

mkdir -p "${bin_dir}"

if [[ -x "${scanner_path}" ]] && "${scanner_path}" --version 2>/dev/null | grep -q "${scanner_version}"; then
  echo "OSV-Scanner ${scanner_version} is already installed at ${scanner_path}"
  exit 0
fi

release_url="https://github.com/google/osv-scanner/releases/download/v${scanner_version}"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

curl --fail --location --silent --show-error "${release_url}/${asset}" --output "${temporary_dir}/${asset}"
curl --fail --location --silent --show-error "${release_url}/osv-scanner_SHA256SUMS" --output "${temporary_dir}/SHA256SUMS"

expected_checksum="$(awk -v asset="${asset}" '$2 == asset { print $1 }' "${temporary_dir}/SHA256SUMS")"
actual_checksum="$(shasum -a 256 "${temporary_dir}/${asset}" | awk '{ print $1 }')"

if [[ -z "${expected_checksum}" || "${actual_checksum}" != "${expected_checksum}" ]]; then
  echo "OSV-Scanner checksum verification failed for ${asset}" >&2
  exit 1
fi

install -m 0755 "${temporary_dir}/${asset}" "${scanner_path}"
echo "Installed OSV-Scanner ${scanner_version} at ${scanner_path}"

