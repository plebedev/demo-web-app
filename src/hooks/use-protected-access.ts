'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  clearStoredAccessToken,
  persistAccessToken,
  readStoredAccessToken,
} from '@/lib/access-token';
import { ExperienceId } from '@/lib/experiences';

type VerificationPayload = {
  experience_id: ExperienceId;
  expires_at: string;
};

export function useProtectedAccess(experienceId: ExperienceId) {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const storedToken = readStoredAccessToken(experienceId);
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
        if (payload.experience_id !== experienceId) {
          throw new Error('Stored access token is for another experience.');
        }
        if (!active) {
          return;
        }

        persistAccessToken({
          accessToken: storedAccessToken,
          experienceId,
          expiresAt: payload.expires_at,
        });
        setAccessToken(storedAccessToken);
        setIsChecking(false);
      } catch {
        if (!active) {
          return;
        }

        clearStoredAccessToken(experienceId);
        setAccessToken(null);
        setIsChecking(false);
        router.replace('/');
      }
    }

    void verifyToken();

    return () => {
      active = false;
    };
  }, [experienceId, router]);

  return {
    accessToken,
    isChecking,
  };
}
