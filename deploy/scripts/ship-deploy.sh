#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

RELEASE_NAME="${RELEASE_NAME:-frontend-bff}"
NAMESPACE="${NAMESPACE:-demo}"
VALUES_FILE="${VALUES_FILE:-${REPO_ROOT}/deploy/helm/frontend-bff/values-demo.yaml}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"
DEPLOY_TARGET="${DEPLOY_TARGET:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/srv/frontend-bff}"
SSH_OPTS="${SSH_OPTS:-}"
KEEP_REMOTE_RELEASES="${KEEP_REMOTE_RELEASES:-3}"

OPERATIONAL_PATHS=(
  .dockerignore
  .env.example
  .eslintrc.json
  .gitignore
  Dockerfile
  Makefile
  next-env.d.ts
  next.config.ts
  package-lock.json
  package.json
  public
  src
  tsconfig.json
  deploy
)

if [[ -z "${DEPLOY_TARGET}" ]]; then
  echo "DEPLOY_TARGET is required. Example: opc@203.0.113.10"
  exit 1
fi

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

IMAGE_TAG="${IMAGE_TAG:-$(git -C "${REPO_ROOT}" rev-parse HEAD)}"
IMAGE_REF="${IMAGE_REPOSITORY}:${IMAGE_TAG}"
IMAGE_ARCHIVE_NAME="${IMAGE_ARCHIVE_NAME:-image-${IMAGE_TAG}.tar}"
SOURCE_ARCHIVE_NAME="${SOURCE_ARCHIVE_NAME:-source-${IMAGE_TAG}.tgz}"
REMOTE_RELEASE_DIR="${DEPLOY_PATH}/releases/${IMAGE_TAG}"

TEMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

echo "Using image tag ${IMAGE_TAG}"
echo "Running Next.js production build"
(cd "${REPO_ROOT}" && npm run build)

echo "Linting Helm chart"
helm lint "${REPO_ROOT}/deploy/helm/frontend-bff"

echo "Building ${IMAGE_REF}"
"${SCRIPT_DIR}/build-image.sh" "${IMAGE_TAG}"

echo "Saving image archive"
docker save -o "${TEMP_DIR}/${IMAGE_ARCHIVE_NAME}" "${IMAGE_REF}"

echo "Packing committed source bundle"
git -C "${REPO_ROOT}" archive --format=tar.gz -o "${TEMP_DIR}/${SOURCE_ARCHIVE_NAME}" HEAD

echo "Preparing remote directory ${DEPLOY_PATH}"
ssh ${SSH_OPTS} "${DEPLOY_TARGET}" "mkdir -p '${DEPLOY_PATH}/releases' '${DEPLOY_PATH}/artifacts/images' '${DEPLOY_PATH}/artifacts/source'"

echo "Copying source and image archives to ${DEPLOY_TARGET}"
scp ${SSH_OPTS} "${TEMP_DIR}/${SOURCE_ARCHIVE_NAME}" "${DEPLOY_TARGET}:${DEPLOY_PATH}/artifacts/source/${SOURCE_ARCHIVE_NAME}"
scp ${SSH_OPTS} "${TEMP_DIR}/${IMAGE_ARCHIVE_NAME}" "${DEPLOY_TARGET}:${DEPLOY_PATH}/artifacts/images/${IMAGE_ARCHIVE_NAME}"

echo "Running remote deploy"
ssh ${SSH_OPTS} "${DEPLOY_TARGET}" \
  "cd '${DEPLOY_PATH}' && \
   rm -rf '${REMOTE_RELEASE_DIR}' && \
   mkdir -p '${REMOTE_RELEASE_DIR}' && \
   tar -xzf './artifacts/source/${SOURCE_ARCHIVE_NAME}' -C '${REMOTE_RELEASE_DIR}' && \
   chmod +x '${REMOTE_RELEASE_DIR}/deploy/scripts/remote-deploy.sh' && \
   SOURCE_ARCHIVE_NAME='${SOURCE_ARCHIVE_NAME}' \
   IMAGE_ARCHIVE_NAME='${IMAGE_ARCHIVE_NAME}' \
   RELEASE_NAME='${RELEASE_NAME}' \
   NAMESPACE='${NAMESPACE}' \
   VALUES_FILE='${VALUES_FILE##${REPO_ROOT}/}' \
   IMAGE_REPOSITORY='${IMAGE_REPOSITORY}' \
   IMAGE_TAG='${IMAGE_TAG}' \
   RELEASE_DIR='${REMOTE_RELEASE_DIR}' \
   KEEP_REMOTE_RELEASES='${KEEP_REMOTE_RELEASES}' \
   bash '${REMOTE_RELEASE_DIR}/deploy/scripts/remote-deploy.sh'"
