'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  clearStoredAccessToken,
  isHardAccessVerificationFailure,
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

    function keepStoredTokenForTransientFailure() {
      if (!active) {
        return;
      }
      setAccessToken(storedAccessToken);
      setIsChecking(false);
    }

    function clearStoredTokenForHardFailure() {
      if (!active) {
        return;
      }
      clearStoredAccessToken(experienceId);
      setAccessToken(null);
      setIsChecking(false);
      router.replace('/');
    }

    async function verifyToken() {
      try {
        const response = await fetch('/api/bff/access/verify', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${storedAccessToken}`,
          },
        });

        if (!response.ok) {
          if (isHardAccessVerificationFailure(response.status)) {
            clearStoredTokenForHardFailure();
            return;
          }
          keepStoredTokenForTransientFailure();
          return;
        }

        const payload = (await response.json()) as VerificationPayload;
        if (payload.experience_id !== experienceId) {
          clearStoredTokenForHardFailure();
          return;
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
        keepStoredTokenForTransientFailure();
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
