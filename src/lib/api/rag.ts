import {
  ApiParseError,
  RequestControl,
  requestJson,
  requestVoid,
} from './http';

export type RagPersona = {
  id: number;
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PersonaListResponse = {
  personas: RagPersona[];
};

export type RagPersonaDocument = {
  document_id: number;
  source: string;
  title: string | null;
  display_name: string | null;
  chunk_count: number;
  linked_at: string;
};

export type PersonaDocumentListResponse = {
  documents: RagPersonaDocument[];
};

export type RagConversation = {
  id: number;
  persona_id: number | null;
  persona_name: string | null;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RagMessage = {
  id: number;
  role: 'user' | 'assistant' | string;
  content: string;
  turn_index: number;
  metadata: string | null;
  created_at: string;
};

export type RagCitation = {
  id: number;
  message_id: number;
  document_id: number;
  chunk_id: number;
  chunk_index: number;
  source: string;
  title: string | null;
  snippet: string;
  rank: number;
};

export type ConversationListResponse = {
  conversations: RagConversation[];
};

export type ConversationDetailResponse = {
  conversation: RagConversation;
  messages: RagMessage[];
};

export type ConversationMessageResponse = {
  user_message: RagMessage;
  assistant_message: RagMessage;
  citations: RagCitation[];
  turns_remaining: number;
};

export type RagPersonaRequest = {
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
};

export type PersonaDocumentUploadResponse = {
  document?: RagPersonaDocument;
  reused_existing_document?: boolean;
};

export type CreateConversationRequest = {
  persona_id: number;
  title: string;
};

/**
 * Mutations historically treated a 2xx response with a missing or unreadable
 * body as a failure the caller reports itself, so map that case to null.
 */
async function tolerateUnreadable<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return (await promise) ?? null;
  } catch (error) {
    if (error instanceof ApiParseError) {
      return null;
    }
    throw error;
  }
}

export function listRagPersonas(
  accessToken: string,
  control?: RequestControl,
): Promise<PersonaListResponse> {
  return requestJson<PersonaListResponse>('/api/bff/rag/personas', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

/** Creates a persona. Resolves null when the backend returns no body. */
export function createRagPersona(
  accessToken: string,
  payload: RagPersonaRequest,
  control?: RequestControl,
): Promise<RagPersona | null> {
  return tolerateUnreadable(
    requestJson<RagPersona>('/api/bff/rag/personas', {
      ...control,
      method: 'POST',
      accessToken,
      json: payload,
    }),
  );
}

/** Updates a persona. Resolves null when the backend returns no body. */
export function updateRagPersona(
  accessToken: string,
  personaId: number,
  payload: RagPersonaRequest,
  control?: RequestControl,
): Promise<RagPersona | null> {
  return tolerateUnreadable(
    requestJson<RagPersona>(`/api/bff/rag/personas/${personaId}`, {
      ...control,
      method: 'PUT',
      accessToken,
      json: payload,
    }),
  );
}

export function deleteRagPersona(
  accessToken: string,
  personaId: number,
  control?: RequestControl,
): Promise<void> {
  return requestVoid(`/api/bff/rag/personas/${personaId}`, {
    ...control,
    method: 'DELETE',
    accessToken,
  });
}

export function listRagPersonaDocuments(
  accessToken: string,
  personaId: number,
  control?: RequestControl,
): Promise<PersonaDocumentListResponse> {
  return requestJson<PersonaDocumentListResponse>(
    `/api/bff/rag/personas/${personaId}/documents`,
    { ...control, accessToken, cache: 'no-store' },
  );
}

/** Multipart document upload. Resolves null for an unreadable body. */
export function uploadRagPersonaDocument(
  accessToken: string,
  personaId: number,
  payload: FormData,
  control?: RequestControl,
): Promise<PersonaDocumentUploadResponse | null> {
  return tolerateUnreadable(
    requestJson<PersonaDocumentUploadResponse>(
      `/api/bff/rag/personas/${personaId}/documents`,
      { ...control, method: 'POST', accessToken, formData: payload },
    ),
  );
}

export function removeRagPersonaDocument(
  accessToken: string,
  personaId: number,
  documentId: number,
  control?: RequestControl,
): Promise<void> {
  return requestVoid(
    `/api/bff/rag/personas/${personaId}/documents/${documentId}`,
    { ...control, method: 'DELETE', accessToken },
  );
}

export function listRagConversations(
  accessToken: string,
  control?: RequestControl,
): Promise<ConversationListResponse> {
  return requestJson<ConversationListResponse>('/api/bff/rag/conversations', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

/** Creates a conversation. Resolves null when the backend returns no body. */
export function createRagConversation(
  accessToken: string,
  payload: CreateConversationRequest,
  control?: RequestControl,
): Promise<RagConversation | null> {
  return tolerateUnreadable(
    requestJson<RagConversation>('/api/bff/rag/conversations', {
      ...control,
      method: 'POST',
      accessToken,
      json: payload,
    }),
  );
}

export function getRagConversation(
  accessToken: string,
  conversationId: number,
  control?: RequestControl,
): Promise<ConversationDetailResponse> {
  return requestJson<ConversationDetailResponse>(
    `/api/bff/rag/conversations/${conversationId}`,
    { ...control, accessToken, cache: 'no-store' },
  );
}

/** Sends a chat message. Resolves null when the backend returns no body. */
export function sendRagMessage(
  accessToken: string,
  conversationId: number,
  content: string,
  control?: RequestControl,
): Promise<ConversationMessageResponse | null> {
  return tolerateUnreadable(
    requestJson<ConversationMessageResponse>(
      `/api/bff/rag/conversations/${conversationId}/messages`,
      { ...control, method: 'POST', accessToken, json: { content } },
    ),
  );
}
