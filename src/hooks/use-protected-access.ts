'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  clearStoredAccessToken,
  isHardAccessVerificationFailure,
  persistAccessToken,
  readStoredAccessToken,
} from '@/lib/access-token';
import { verifyAccessToken } from '@/lib/api/access';
import { isAbortError, isApiError } from '@/lib/api/http';
import { ExperienceId } from '@/lib/experiences';

export function useProtectedAccess(
  experienceId: ExperienceId,
  options?: { redirect?: boolean },
) {
  const shouldRedirect = options?.redirect !== false;
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const storedToken = readStoredAccessToken(experienceId);
    if (!storedToken) {
      if (shouldRedirect) {
        router.replace('/');
      }
      setIsChecking(false);
      return;
    }
    const storedAccessToken = storedToken.accessToken;

    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted;

    function keepStoredTokenForTransientFailure() {
      if (!isCurrent()) {
        return;
      }
      setAccessToken(storedAccessToken);
      setIsChecking(false);
    }

    function clearStoredTokenForHardFailure() {
      if (!isCurrent()) {
        return;
      }
      clearStoredAccessToken(experienceId);
      setAccessToken(null);
      setIsChecking(false);
      if (shouldRedirect) {
        router.replace('/');
      }
    }

    async function verifyToken() {
      try {
        const payload = await verifyAccessToken(storedAccessToken, {
          signal: controller.signal,
        });
        if (payload.experience_id !== experienceId) {
          clearStoredTokenForHardFailure();
          return;
        }
        if (!isCurrent()) {
          return;
        }

        persistAccessToken({
          accessToken: storedAccessToken,
          experienceId,
          expiresAt: payload.expires_at,
        });
        setAccessToken(storedAccessToken);
        setIsChecking(false);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (
          isApiError(error) &&
          isHardAccessVerificationFailure(error.status)
        ) {
          clearStoredTokenForHardFailure();
          return;
        }
        keepStoredTokenForTransientFailure();
      }
    }

    void verifyToken();

    return () => {
      controller.abort();
    };
  }, [experienceId, router, shouldRedirect]);

  return {
    accessToken,
    isChecking,
  };
}
