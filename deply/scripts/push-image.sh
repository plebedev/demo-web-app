#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "IMAGE_TAG is required. Pass it as the first argument or export IMAGE_TAG."
  exit 1
fi

if [[ -z "${IMAGE_REGISTRY}" ]]; then
  echo "IMAGE_REGISTRY is required for push."
  exit 1
fi

IMAGE_REF="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}:${IMAGE_TAG}"

echo "Pushing ${IMAGE_REF}"
docker push "${IMAGE_REF}"
