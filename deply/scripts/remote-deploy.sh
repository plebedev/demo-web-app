#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SOURCE_ARCHIVE_NAME="${SOURCE_ARCHIVE_NAME:-source.tgz}"
IMAGE_ARCHIVE_NAME="${IMAGE_ARCHIVE_NAME:-image.tar}"
RELEASE_NAME="${RELEASE_NAME:-frontend-bff}"
NAMESPACE="${NAMESPACE:-demo}"
VALUES_FILE="${VALUES_FILE:-deply/helm/frontend-bff/values-demo.yaml}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"
IMAGE_TAG="${IMAGE_TAG:-}"
IMPORT_IMAGE_COMMAND="${IMPORT_IMAGE_COMMAND:-sudo k3s ctr images import}"

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "IMAGE_TAG is required."
  exit 1
fi

if [[ ! -f "${REMOTE_ROOT}/${SOURCE_ARCHIVE_NAME}" ]]; then
  echo "Source archive not found: ${REMOTE_ROOT}/${SOURCE_ARCHIVE_NAME}"
  exit 1
fi

if [[ ! -f "${REMOTE_ROOT}/${IMAGE_ARCHIVE_NAME}" ]]; then
  echo "Image archive not found: ${REMOTE_ROOT}/${IMAGE_ARCHIVE_NAME}"
  exit 1
fi

echo "Extracting source bundle"
tar -xzf "${REMOTE_ROOT}/${SOURCE_ARCHIVE_NAME}" -C "${REMOTE_ROOT}"

if [[ ! -f "${REMOTE_ROOT}/${VALUES_FILE}" ]]; then
  echo "Values file not found after extract: ${REMOTE_ROOT}/${VALUES_FILE}"
  exit 1
fi

echo "Importing image into k3s containerd"
${IMPORT_IMAGE_COMMAND} "${REMOTE_ROOT}/${IMAGE_ARCHIVE_NAME}"

echo "Deploying release ${RELEASE_NAME} to namespace ${NAMESPACE}"
RELEASE_NAME="${RELEASE_NAME}" \
NAMESPACE="${NAMESPACE}" \
VALUES_FILE="${REMOTE_ROOT}/${VALUES_FILE}" \
IMAGE_REGISTRY="" \
IMAGE_REPOSITORY="${IMAGE_REPOSITORY}" \
IMAGE_TAG="${IMAGE_TAG}" \
helm upgrade --install "${RELEASE_NAME}" "${REMOTE_ROOT}/deply/helm/frontend-bff" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  -f "${REMOTE_ROOT}/deply/helm/frontend-bff/values.yaml" \
  -f "${REMOTE_ROOT}/${VALUES_FILE}" \
  --set-string namespace="${NAMESPACE}" \
  --set-string image.registry="" \
  --set-string image.repository="${IMAGE_REPOSITORY}" \
  --set-string image.tag="${IMAGE_TAG}" \
  --set-string image.pullPolicy="Never" \
  --wait \
  --timeout 5m

kubectl get ingress,service,deployment,pods -n "${NAMESPACE}" -l "app.kubernetes.io/instance=${RELEASE_NAME}"
