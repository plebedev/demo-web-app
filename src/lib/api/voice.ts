import { isApiError, RequestControl, requestJson, requestVoid } from './http';

export type VoicePersona = {
  id: number;
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
  tool_names?: string[];
  is_active: boolean;
};

export type VoiceProvider = {
  provider_id: string;
  provider_name: string;
  voices: string[];
};

export type VoiceTool = {
  name: string;
  description: string;
  is_terminal: boolean;
};

export type VoiceConfig = {
  id: number;
  experience_id: string;
  voice_name: string;
  voice_provider: string | null;
  synthesized_greeting: string | null;
  greeting_synced_at: string | null;
};

export type ConversationSummary = {
  id: number;
  call_sid: string;
  provider: string;
  voice: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  input_audio_seconds: number | null;
  output_audio_seconds: number | null;
  estimated_cost_usd: number | null;
  entry_count: number;
};

export type HistoryTranscriptEntry =
  | { role: 'advisor' | 'user'; text: string }
  | { role: 'tool_call'; tool_name: string; args: Record<string, unknown> };

export type ConversationDetail = ConversationSummary & {
  transcript: HistoryTranscriptEntry[];
};

export type VoicePersonaListResponse = {
  personas: VoicePersona[];
};

export type VoiceProviderListResponse = {
  providers: VoiceProvider[];
};

export type VoiceToolListResponse = {
  tools: VoiceTool[];
};

export type VoiceHistoryResponse = {
  conversations: ConversationSummary[];
};

export type VoiceConfigRequest = {
  voice_name: string;
  voice_provider: string | null;
};

export type CreateVoicePersonaRequest = {
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
  tool_names: string[];
};

export type UpdateVoicePersonaRequest = Omit<CreateVoicePersonaRequest, 'name'>;

export function listVoicePersonas(
  accessToken: string,
  control?: RequestControl,
): Promise<VoicePersonaListResponse> {
  return requestJson<VoicePersonaListResponse>('/api/bff/voice/personas', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

/** Loads the voice config, or null when none has been created yet (404). */
export async function getVoiceConfig(
  accessToken: string,
  control?: RequestControl,
): Promise<VoiceConfig | null> {
  try {
    return await requestJson<VoiceConfig>('/api/bff/voice/config', {
      ...control,
      accessToken,
      cache: 'no-store',
    });
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function saveVoiceConfig(
  accessToken: string,
  payload: VoiceConfigRequest,
  control?: RequestControl,
): Promise<VoiceConfig> {
  return requestJson<VoiceConfig>('/api/bff/voice/config', {
    ...control,
    method: 'PUT',
    accessToken,
    json: payload,
  });
}

export function listVoiceProviders(
  accessToken: string,
  control?: RequestControl,
): Promise<VoiceProviderListResponse> {
  return requestJson<VoiceProviderListResponse>('/api/bff/voice/providers', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function listVoiceTools(
  accessToken: string,
  control?: RequestControl,
): Promise<VoiceToolListResponse> {
  return requestJson<VoiceToolListResponse>('/api/bff/voice/tools', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function createVoicePersona(
  accessToken: string,
  payload: CreateVoicePersonaRequest,
  control?: RequestControl,
): Promise<VoicePersona> {
  return requestJson<VoicePersona>('/api/bff/voice/personas', {
    ...control,
    method: 'POST',
    accessToken,
    json: payload,
  });
}

export function updateVoicePersona(
  accessToken: string,
  personaId: number,
  payload: UpdateVoicePersonaRequest,
  control?: RequestControl,
): Promise<VoicePersona> {
  return requestJson<VoicePersona>(`/api/bff/voice/personas/${personaId}`, {
    ...control,
    method: 'PATCH',
    accessToken,
    json: payload,
  });
}

export function deactivateVoicePersona(
  accessToken: string,
  personaId: number,
  control?: RequestControl,
): Promise<void> {
  return requestVoid(`/api/bff/voice/personas/${personaId}/deactivate`, {
    ...control,
    method: 'POST',
    accessToken,
  });
}

export function listVoiceHistory(
  accessToken: string,
  control?: RequestControl,
): Promise<VoiceHistoryResponse> {
  return requestJson<VoiceHistoryResponse>('/api/bff/voice/history', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function getVoiceConversation(
  accessToken: string,
  conversationId: number,
  control?: RequestControl,
): Promise<ConversationDetail> {
  return requestJson<ConversationDetail>(
    `/api/bff/voice/history/${conversationId}`,
    { ...control, accessToken },
  );
}
