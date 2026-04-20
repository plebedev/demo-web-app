type RuntimeConfig = {
  appName: string;
  stage: string;
  backendBaseUrl: string;
};

export function resolveBackendBaseUrl(): string {
  if (process.env.BACKEND_BASE_URL) {
    return process.env.BACKEND_BASE_URL;
  }

  if (process.env.NODE_ENV === 'development') {
    return (
      process.env.BACKEND_LOCAL_URL || process.env.BACKEND_CLUSTER_URL || ''
    );
  }

  return process.env.BACKEND_CLUSTER_URL || process.env.BACKEND_LOCAL_URL || '';
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    appName:
      process.env.NEXT_PUBLIC_APP_NAME ||
      process.env.APP_NAME ||
      'Frontend BFF',
    stage: process.env.NEXT_PUBLIC_STAGE || 'unknown',
    backendBaseUrl: resolveBackendBaseUrl(),
  };
}
