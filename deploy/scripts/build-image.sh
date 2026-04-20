#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"

if [[ -z "${IMAGE_TAG}" ]]; then
  IMAGE_TAG="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
fi

IMAGE_REF="${IMAGE_REPOSITORY}:${IMAGE_TAG}"

echo "Building ${IMAGE_REF}"
docker build -t "${IMAGE_REF}" "${REPO_ROOT}"
