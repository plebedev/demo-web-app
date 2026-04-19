#!/usr/bin/env bash
set -euo pipefail

RELEASE_NAME="${RELEASE_NAME:-frontend-bff}"
NAMESPACE="${NAMESPACE:-demo}"
REVISION="${1:-${REVISION:-}}"

if [[ -z "${REVISION}" ]]; then
  echo "Helm history for ${RELEASE_NAME} in namespace ${NAMESPACE}:"
  helm history "${RELEASE_NAME}" --namespace "${NAMESPACE}"
  echo
  echo "Set REVISION or pass the revision number as the first argument to perform a rollback."
  exit 0
fi

helm rollback "${RELEASE_NAME}" "${REVISION}" --namespace "${NAMESPACE}" --wait --timeout 5m
kubectl rollout status deployment/"${RELEASE_NAME}" -n "${NAMESPACE}"
