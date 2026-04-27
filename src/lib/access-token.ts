export const ACCESS_TOKEN_STORAGE_KEY = 'demo.phase1.accessToken';

export type StoredAccessToken = {
  accessToken: string;
  expiresAt: string;
};

export function readStoredAccessToken(): StoredAccessToken | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAccessToken;
  } catch {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return null;
  }
}

export function persistAccessToken(token: StoredAccessToken): void {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, JSON.stringify(token));
}

export function clearStoredAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}
