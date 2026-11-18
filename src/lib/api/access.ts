import type { Experience, ExperienceId } from '@/lib/experiences';

import { ApiParseError, RequestControl, requestJson } from './http';

export type ExperienceListResponse = {
  experiences: Experience[];
};

export type AccessVerificationResponse = {
  experience_id: ExperienceId;
  expires_at: string;
};

export type AccessRedeemRequest = {
  code: string;
};

export type AccessRedeemResponse = {
  access_token: string;
  experience_id: ExperienceId;
  redirect_path: string;
  expires_at: string;
};

export type InviteRequestPayload = {
  name: string;
  email: string;
  reason: string;
  experience_id: ExperienceId;
};

export type InviteRequestResponse = {
  message?: string;
};

export function listExperiences(
  control?: RequestControl,
): Promise<ExperienceListResponse> {
  return requestJson<ExperienceListResponse>('/api/bff/experiences', {
    ...control,
    cache: 'no-store',
  });
}

export function verifyAccessToken(
  accessToken: string,
  control?: RequestControl,
): Promise<AccessVerificationResponse> {
  return requestJson<AccessVerificationResponse>('/api/bff/access/verify', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function redeemInvitationCode(
  payload: AccessRedeemRequest,
  control?: RequestControl,
): Promise<AccessRedeemResponse> {
  return requestJson<AccessRedeemResponse>('/api/bff/access/redeem', {
    ...control,
    method: 'POST',
    json: payload,
  });
}

export async function submitInviteRequest(
  payload: InviteRequestPayload,
  control?: RequestControl,
): Promise<InviteRequestResponse | null> {
  try {
    const response = await requestJson<InviteRequestResponse | undefined>(
      '/api/bff/access/invite-requests',
      { ...control, method: 'POST', json: payload },
    );
    return response ?? null;
  } catch (error) {
    // A successful submission without a readable body is still a success.
    if (error instanceof ApiParseError) {
      return null;
    }
    throw error;
  }
}
