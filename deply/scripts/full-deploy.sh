#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CHART_DIR="${CHART_DIR:-${REPO_ROOT}/deply/helm/frontend-bff}"

RELEASE_NAME="${RELEASE_NAME:-frontend-bff}"
NAMESPACE="${NAMESPACE:-demo}"
VALUES_FILE="${VALUES_FILE:-${REPO_ROOT}/deply/helm/frontend-bff/values-demo.yaml}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"

OPERATIONAL_PATHS=(
  .dockerignore
  .env.example
  .eslintrc.json
  Dockerfile
  next-env.d.ts
  next.config.ts
  package-lock.json
  package.json
  public
  src
  tsconfig.json
  deply
)

if ! git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This command must run inside a git repository."
  exit 1
fi

if ! git -C "${REPO_ROOT}" rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "No commit found yet. Commit the repo first so the image tag can use the current commit hash."
  exit 1
fi

DIRTY_STATUS="$(git -C "${REPO_ROOT}" status --short -- "${OPERATIONAL_PATHS[@]}")"
if [[ -n "${DIRTY_STATUS}" ]]; then
  echo "Refusing to deploy because operational files have uncommitted changes:"
  echo "${DIRTY_STATUS}"
  echo
  echo "Commit or discard those changes, then rerun the command."
  exit 1
fi

if [[ "${VALUES_FILE}" != /* ]]; then
  VALUES_FILE="${REPO_ROOT}/${VALUES_FILE}"
fi

if [[ ! -f "${VALUES_FILE}" ]]; then
  echo "Values file not found: ${VALUES_FILE}"
  exit 1
fi

if [[ -z "${IMAGE_REGISTRY}" ]]; then
  echo "IMAGE_REGISTRY is required for the full deploy cycle."
  exit 1
fi

IMAGE_TAG="${IMAGE_TAG:-$(git -C "${REPO_ROOT}" rev-parse HEAD)}"
export IMAGE_TAG
export IMAGE_REGISTRY
export IMAGE_REPOSITORY
export RELEASE_NAME
export NAMESPACE
export VALUES_FILE
export CHART_DIR

echo "Using image tag ${IMAGE_TAG}"
echo "Running Next.js production build"
(cd "${REPO_ROOT}" && npm run build)

echo "Linting Helm chart"
helm lint "${CHART_DIR}"

"${SCRIPT_DIR}/build-image.sh" "${IMAGE_TAG}"
"${SCRIPT_DIR}/push-image.sh" "${IMAGE_TAG}"
"${SCRIPT_DIR}/deploy.sh" "${IMAGE_TAG}"
