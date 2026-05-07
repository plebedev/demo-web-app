import { ExperienceId, isExperienceId } from '@/lib/experiences';

export const ACCESS_TOKEN_STORAGE_KEY = 'demo.phase1.accessTokens.v1';
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'demo.phase1.accessToken';

export type StoredAccessToken = {
  accessToken: string;
  expiresAt: string;
  experienceId: ExperienceId;
};

export type StoredAccessTokens = Partial<
  Record<ExperienceId, StoredAccessToken>
>;

function readTokenMap(): StoredAccessTokens {
  if (typeof window === 'undefined') {
    return {};
  }

  const rawValue = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, StoredAccessToken>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([key, token]) => {
        return (
          isExperienceId(key) &&
          token.experienceId === key &&
          typeof token.accessToken === 'string' &&
          typeof token.expiresAt === 'string'
        );
      }),
    ) as StoredAccessTokens;
  } catch {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return {};
  }
}

function writeTokenMap(tokens: StoredAccessTokens): void {
  if (Object.keys(tokens).length === 0) {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } else {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify(tokens),
    );
  }
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
}

export function readStoredAccessTokens(): StoredAccessTokens {
  return readTokenMap();
}

export function readStoredAccessToken(
  experienceId: ExperienceId,
): StoredAccessToken | null {
  return readTokenMap()[experienceId] || null;
}

export function persistAccessToken(token: StoredAccessToken): void {
  writeTokenMap({
    ...readTokenMap(),
    [token.experienceId]: token,
  });
}

export function clearStoredAccessToken(experienceId: ExperienceId): void {
  const tokens = readTokenMap();
  delete tokens[experienceId];
  writeTokenMap(tokens);
}

export function clearAllStoredAccessTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
}

export function isHardAccessVerificationFailure(status: number): boolean {
  return status === 401 || status === 403;
}
