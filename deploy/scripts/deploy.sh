#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

RELEASE_NAME="${RELEASE_NAME:-frontend-bff}"
NAMESPACE="${NAMESPACE:-demo}"
VALUES_FILE="${VALUES_FILE:-${REPO_ROOT}/deploy/helm/frontend-bff/values-demo.yaml}"
IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-frontend-bff}"
CHART_DIR="${CHART_DIR:-${REPO_ROOT}/deploy/helm/frontend-bff}"

if [[ -z "${IMAGE_TAG}" ]]; then
  echo "IMAGE_TAG is required. Pass it as the first argument or export IMAGE_TAG."
  exit 1
fi

if [[ "${VALUES_FILE}" != /* ]]; then
  VALUES_FILE="${REPO_ROOT}/${VALUES_FILE}"
fi

if [[ "${CHART_DIR}" != /* ]]; then
  CHART_DIR="${REPO_ROOT}/${CHART_DIR}"
fi

if [[ ! -f "${VALUES_FILE}" ]]; then
  echo "Values file not found: ${VALUES_FILE}"
  exit 1
fi

kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}"

helm upgrade --install "${RELEASE_NAME}" "${CHART_DIR}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  -f "${CHART_DIR}/values.yaml" \
  -f "${VALUES_FILE}" \
  --set-string namespace="${NAMESPACE}" \
  --set-string image.registry="${IMAGE_REGISTRY}" \
  --set-string image.repository="${IMAGE_REPOSITORY}" \
  --set-string image.tag="${IMAGE_TAG}" \
  --wait \
  --timeout 5m

kubectl get ingress,service,deployment,pods -n "${NAMESPACE}" -l "app.kubernetes.io/instance=${RELEASE_NAME}"
