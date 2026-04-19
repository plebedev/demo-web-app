#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "IMAGE_TAG is required. Pass it as the first argument or export IMAGE_TAG."
  exit 1
fi

if [[ -n "${IMAGE_REGISTRY}" ]]; then
  IMAGE_REF="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}:${IMAGE_TAG}"
else
  IMAGE_REF="${IMAGE_REPOSITORY}:${IMAGE_TAG}"
fi

echo "Building ${IMAGE_REF}"
docker build -t "${IMAGE_REF}" "${REPO_ROOT}"
