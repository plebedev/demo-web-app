type RuntimeConfig = {
  appName: string;
  stage: string;
  backendBaseUrl: string;
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || process.env.APP_NAME || "Frontend BFF",
    stage: process.env.NEXT_PUBLIC_STAGE || "unknown",
    backendBaseUrl: process.env.BACKEND_BASE_URL || ""
  };
}
