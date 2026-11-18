import { RequestControl, requestJson } from './http';

export type BackendHealthResponse = {
  status: string;
};

export type FeatureStatusResponse = {
  features?: Record<string, boolean>;
};

/** Unauthenticated probe of the BFF's backend health route. */
export function getBackendHealth(
  control?: RequestControl,
): Promise<BackendHealthResponse> {
  return requestJson<BackendHealthResponse>('/api/backend-health', {
    ...control,
    cache: 'no-store',
  });
}

export function getFeatureStatus(
  accessToken: string,
  control?: RequestControl,
): Promise<FeatureStatusResponse> {
  return requestJson<FeatureStatusResponse>('/api/bff/status', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}
