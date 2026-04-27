'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  clearStoredAccessToken,
  persistAccessToken,
  readStoredAccessToken,
} from '@/lib/access-token';

type VerificationPayload = {
  expires_at: string;
};

export function useProtectedAccess() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const storedToken = readStoredAccessToken();
    if (!storedToken) {
      router.replace('/');
      setIsChecking(false);
      return;
    }
    const storedAccessToken = storedToken.accessToken;

    let active = true;

    async function verifyToken() {
      try {
        const response = await fetch('/api/bff/access/verify', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${storedAccessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Stored access token is no longer valid.');
        }

        const payload = (await response.json()) as VerificationPayload;
        if (!active) {
          return;
        }

        persistAccessToken({
          accessToken: storedAccessToken,
          expiresAt: payload.expires_at,
        });
        setAccessToken(storedAccessToken);
        setIsChecking(false);
      } catch {
        if (!active) {
          return;
        }

        clearStoredAccessToken();
        setAccessToken(null);
        setIsChecking(false);
        router.replace('/');
      }
    }

    void verifyToken();

    return () => {
      active = false;
    };
  }, [router]);

  return {
    accessToken,
    isChecking,
  };
}
