#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="${RELEASE_DIR:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
DEPLOY_ROOT="$(cd "${RELEASE_DIR}/../.." && pwd)"

SOURCE_ARCHIVE_NAME="${SOURCE_ARCHIVE_NAME:-source.tgz}"
IMAGE_ARCHIVE_NAME="${IMAGE_ARCHIVE_NAME:-image.tar}"
RELEASE_NAME="${RELEASE_NAME:-frontend-bff}"
NAMESPACE="${NAMESPACE:-demo}"
VALUES_FILE="${VALUES_FILE:-deploy/helm/frontend-bff/values-demo.yaml}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"
IMAGE_TAG="${IMAGE_TAG:-}"
IMPORT_IMAGE_COMMAND="${IMPORT_IMAGE_COMMAND:-sudo k3s ctr images import}"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-/etc/rancher/k3s/k3s.yaml}"
KEEP_REMOTE_RELEASES="${KEEP_REMOTE_RELEASES:-3}"

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "IMAGE_TAG is required."
  exit 1
fi

if [[ ! -f "${DEPLOY_ROOT}/artifacts/source/${SOURCE_ARCHIVE_NAME}" ]]; then
  echo "Source archive not found: ${DEPLOY_ROOT}/artifacts/source/${SOURCE_ARCHIVE_NAME}"
  exit 1
fi

if [[ ! -f "${DEPLOY_ROOT}/artifacts/images/${IMAGE_ARCHIVE_NAME}" ]]; then
  echo "Image archive not found: ${DEPLOY_ROOT}/artifacts/images/${IMAGE_ARCHIVE_NAME}"
  exit 1
fi

if [[ ! -f "${RELEASE_DIR}/${VALUES_FILE}" ]]; then
  echo "Values file not found after extract: ${RELEASE_DIR}/${VALUES_FILE}"
  exit 1
fi

echo "Importing image into k3s containerd"
${IMPORT_IMAGE_COMMAND} "${DEPLOY_ROOT}/artifacts/images/${IMAGE_ARCHIVE_NAME}"

echo "Deploying release ${RELEASE_NAME} to namespace ${NAMESPACE}"
export KUBECONFIG="${KUBECONFIG_PATH}"
RELEASE_NAME="${RELEASE_NAME}" \
NAMESPACE="${NAMESPACE}" \
VALUES_FILE="${RELEASE_DIR}/${VALUES_FILE}" \
IMAGE_REGISTRY="" \
IMAGE_REPOSITORY="${IMAGE_REPOSITORY}" \
IMAGE_TAG="${IMAGE_TAG}" \
helm upgrade --install "${RELEASE_NAME}" "${RELEASE_DIR}/deploy/helm/frontend-bff" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  -f "${RELEASE_DIR}/deploy/helm/frontend-bff/values.yaml" \
  -f "${RELEASE_DIR}/${VALUES_FILE}" \
  --set-string namespace="${NAMESPACE}" \
  --set-string image.registry="" \
  --set-string image.repository="${IMAGE_REPOSITORY}" \
  --set-string image.tag="${IMAGE_TAG}" \
  --set-string image.pullPolicy="Never" \
  --wait \
  --timeout 5m

kubectl get ingress,service,deployment,pods -n "${NAMESPACE}" -l "app.kubernetes.io/instance=${RELEASE_NAME}"

cleanup_old_artifacts() {
  local keep_count="$1"
  local target_dir="$2"

  if [[ ! -d "${target_dir}" ]]; then
    return 0
  fi

  mapfile -t entries < <(find "${target_dir}" -mindepth 1 -maxdepth 1 -printf '%T@ %P\n' | sort -nr | awk '{print $2}')
  if (( ${#entries[@]} <= keep_count )); then
    return 0
  fi

  for entry in "${entries[@]:keep_count}"; do
    rm -rf "${target_dir}/${entry}"
  done
}

echo "Pruning remote deploy artifacts, keeping the newest ${KEEP_REMOTE_RELEASES}"
cleanup_old_artifacts "${KEEP_REMOTE_RELEASES}" "${DEPLOY_ROOT}/releases"
cleanup_old_artifacts "${KEEP_REMOTE_RELEASES}" "${DEPLOY_ROOT}/artifacts/images"
cleanup_old_artifacts "${KEEP_REMOTE_RELEASES}" "${DEPLOY_ROOT}/artifacts/source"
