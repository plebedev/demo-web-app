'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { clearStoredAccessToken } from '@/lib/access-token';
import { useProtectedAccess } from '@/hooks/use-protected-access';

type RagTab = 'chat' | 'configuration';

type RagPersona = {
  id: number;
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PersonaListResponse = {
  personas: RagPersona[];
};

type RagPersonaDocument = {
  document_id: number;
  source: string;
  title: string | null;
  display_name: string | null;
  chunk_count: number;
  linked_at: string;
};

type PersonaDocumentListResponse = {
  documents: RagPersonaDocument[];
};

type PersonaFormState = {
  name: string;
  instructions: string;
  capabilities: string;
};

type DocumentFormState = {
  title: string;
  source: string;
  inputText: string;
  file: File | null;
};

const emptyPersonaForm: PersonaFormState = {
  name: '',
  instructions: '',
  capabilities: '',
};

const emptyDocumentForm: DocumentFormState = {
  title: '',
  source: '',
  inputText: '',
  file: null,
};

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export function RagComingSoon() {
  const router = useRouter();
  const { accessToken, isChecking } = useProtectedAccess('rag-demo');
  const [activeTab, setActiveTab] = useState<RagTab>('configuration');
  const [personas, setPersonas] = useState<RagPersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(
    null,
  );
  const [form, setForm] = useState<PersonaFormState>(emptyPersonaForm);
  const [documents, setDocuments] = useState<RagPersonaDocument[]>([]);
  const [documentForm, setDocumentForm] =
    useState<DocumentFormState>(emptyDocumentForm);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) || null,
    [personas, selectedPersonaId],
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let active = true;
    const token = accessToken;

    async function loadPersonas() {
      setIsLoadingPersonas(true);
      try {
        const response = await fetch('/api/bff/rag/personas', {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        if (!response.ok) {
          throw new Error('Unable to load personas.');
        }
        const payload = (await response.json()) as PersonaListResponse;
        if (!active) {
          return;
        }
        setPersonas(payload.personas);
        setSelectedPersonaId((current) => {
          if (
            current !== null &&
            payload.personas.some((persona) => persona.id === current)
          ) {
            return current;
          }
          return payload.personas[0]?.id || null;
        });
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load personas.',
        );
      } finally {
        if (active) {
          setIsLoadingPersonas(false);
        }
      }
    }

    void loadPersonas();

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (selectedPersona) {
      setForm({
        name: selectedPersona.name,
        instructions: selectedPersona.instructions,
        capabilities: selectedPersona.capabilities || '',
      });
      return;
    }
    setForm(emptyPersonaForm);
  }, [selectedPersona]);

  useEffect(() => {
    if (!accessToken || selectedPersonaId === null) {
      setDocuments([]);
      return;
    }
    let active = true;
    const token = accessToken;
    const personaId = selectedPersonaId;

    async function loadDocuments() {
      setIsLoadingDocuments(true);
      try {
        const response = await fetch(
          `/api/bff/rag/personas/${personaId}/documents`,
          {
            cache: 'no-store',
            headers: authHeaders(token),
          },
        );
        if (!response.ok) {
          throw new Error('Unable to load persona documents.');
        }
        const payload = (await response.json()) as PersonaDocumentListResponse;
        if (!active) {
          return;
        }
        setDocuments(payload.documents);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load persona documents.',
        );
      } finally {
        if (active) {
          setIsLoadingDocuments(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      active = false;
    };
  }, [accessToken, selectedPersonaId]);

  function handleSignOut() {
    clearStoredAccessToken('rag-demo');
    router.replace('/');
  }

  function handleNewPersona() {
    setSelectedPersonaId(null);
    setForm(emptyPersonaForm);
    setError(null);
    setNotice(null);
  }

  async function handlePersonaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setIsSavingPersona(true);
    setError(null);
    setNotice(null);

    const payload = {
      name: form.name,
      instructions: form.instructions,
      capabilities: form.capabilities || null,
      tool_config: null,
    };
    const targetPath =
      selectedPersonaId === null
        ? '/api/bff/rag/personas'
        : `/api/bff/rag/personas/${selectedPersonaId}`;

    try {
      const response = await fetch(targetPath, {
        method: selectedPersonaId === null ? 'POST' : 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload),
      });
      const responsePayload = (await response.json().catch(() => null)) as
        | (RagPersona & { detail?: string })
        | null;
      if (!response.ok || responsePayload === null) {
        throw new Error(
          typeof responsePayload?.detail === 'string'
            ? responsePayload.detail
            : 'Unable to save persona.',
        );
      }

      setPersonas((current) => {
        if (selectedPersonaId === null) {
          return [...current, responsePayload].sort((left, right) =>
            left.name.localeCompare(right.name),
          );
        }
        return current.map((persona) =>
          persona.id === responsePayload.id ? responsePayload : persona,
        );
      });
      setSelectedPersonaId(responsePayload.id);
      setNotice('Persona saved.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save persona.',
      );
    } finally {
      setIsSavingPersona(false);
    }
  }

  async function handleDeletePersona() {
    if (!accessToken || selectedPersonaId === null) {
      return;
    }
    setIsSavingPersona(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/bff/rag/personas/${selectedPersonaId}`,
        {
          method: 'DELETE',
          headers: authHeaders(accessToken),
        },
      );
      if (!response.ok) {
        throw new Error('Unable to delete persona.');
      }
      setPersonas((current) =>
        current.filter((persona) => persona.id !== selectedPersonaId),
      );
      setSelectedPersonaId(null);
      setForm(emptyPersonaForm);
      setDocuments([]);
      setNotice('Persona deleted.');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete persona.',
      );
    } finally {
      setIsSavingPersona(false);
    }
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || selectedPersonaId === null) {
      return;
    }
    setIsUploadingDocument(true);
    setError(null);
    setNotice(null);

    const body = new FormData();
    if (documentForm.title.trim()) {
      body.set('title', documentForm.title.trim());
    }
    if (documentForm.source.trim()) {
      body.set('source', documentForm.source.trim());
    }
    if (documentForm.inputText.trim()) {
      body.set('input_text', documentForm.inputText.trim());
    }
    if (documentForm.file) {
      body.set('file', documentForm.file);
    }

    try {
      const response = await fetch(
        `/api/bff/rag/personas/${selectedPersonaId}/documents`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body,
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        document?: RagPersonaDocument;
        reused_existing_document?: boolean;
        detail?: string;
      } | null;
      if (!response.ok || !payload?.document) {
        throw new Error(
          typeof payload?.detail === 'string'
            ? payload.detail
            : 'Unable to upload document.',
        );
      }
      const uploadedDocument = payload.document;
      setDocuments((current) => {
        const withoutExisting = current.filter(
          (document) => document.document_id !== uploadedDocument.document_id,
        );
        return [uploadedDocument, ...withoutExisting];
      });
      setDocumentForm(emptyDocumentForm);
      setNotice(
        payload.reused_existing_document
          ? 'Existing document linked to persona.'
          : 'Document uploaded and linked to persona.',
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Unable to upload document.',
      );
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function handleRemoveDocument(documentId: number) {
    if (!accessToken || selectedPersonaId === null) {
      return;
    }
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/bff/rag/personas/${selectedPersonaId}/documents/${documentId}`,
        {
          method: 'DELETE',
          headers: authHeaders(accessToken),
        },
      );
      if (!response.ok) {
        throw new Error('Unable to remove document from persona.');
      }
      setDocuments((current) =>
        current.filter((document) => document.document_id !== documentId),
      );
      setNotice('Document removed from persona.');
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Unable to remove document from persona.',
      );
    }
  }

  return (
    <main className="shell shell--workspace">
      <header className="topbar topbar--workspace">
        <Link className="brand" href="/rag-demo">
          <span className="brand-mark">R</span>
          <span>
            <strong>RAG Demo</strong>
            <small>Protected retrieval workspace</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="RAG demo">
          <button
            className={activeTab === 'chat' ? 'topnav-link-active' : ''}
            onClick={() => setActiveTab('chat')}
            type="button"
          >
            Chat
          </button>
          <button
            className={
              activeTab === 'configuration' ? 'topnav-link-active' : ''
            }
            onClick={() => setActiveTab('configuration')}
            type="button"
          >
            Configuration
          </button>
          <Link href="/">Access hub</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <button
          className="secondary-button"
          onClick={handleSignOut}
          type="button"
        >
          Leave demo
        </button>
      </header>

      {isChecking ? (
        <section className="workspace-hero">
          <div className="hero-copy">
            <p className="eyebrow">RAG demo</p>
            <h1>Checking your saved RAG access.</h1>
          </div>
        </section>
      ) : activeTab === 'chat' ? (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Chat</p>
            <h2>Chat is not wired yet.</h2>
            <p className="lede lede--compact">
              This milestone establishes tenant-scoped personas and storage
              boundaries first. The chat turn execution, retrieval, citations,
              artifacts, and PDF export come after that foundation is verified.
            </p>
          </div>
        </section>
      ) : (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Configuration</p>
            <h2>Configure assistant personas.</h2>
            <p className="lede lede--compact">
              Personas are scoped to this invitation code. Future uploads and
              retrieval will be limited to documents linked to the selected
              persona.
            </p>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {notice ? <p className="success-text">{notice}</p> : null}

          <div className="rag-config-grid">
            <section className="section-card rag-persona-list">
              <div className="run-card-row">
                <div>
                  <p className="card-kicker">Personas</p>
                  <h3>Available assistants</h3>
                </div>
                <button
                  className="secondary-button"
                  onClick={handleNewPersona}
                  type="button"
                >
                  New
                </button>
              </div>

              {isLoadingPersonas ? (
                <p className="section-detail">Loading personas.</p>
              ) : personas.length === 0 ? (
                <p className="section-detail">
                  No personas yet. Create one to define how the future RAG
                  assistant should behave.
                </p>
              ) : (
                <div className="rag-persona-list-items">
                  {personas.map((persona) => (
                    <button
                      className={`rag-persona-list-item ${
                        persona.id === selectedPersonaId
                          ? 'rag-persona-list-item--active'
                          : ''
                      }`}
                      key={persona.id}
                      onClick={() => setSelectedPersonaId(persona.id)}
                      type="button"
                    >
                      <strong>{persona.name}</strong>
                      <span>
                        {persona.capabilities || 'No capabilities set'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="section-card">
              <p className="card-kicker">
                {selectedPersona ? 'Edit persona' : 'Create persona'}
              </p>
              <form className="invite-form" onSubmit={handlePersonaSubmit}>
                <label className="field-label" htmlFor="rag-persona-name">
                  Name
                </label>
                <input
                  id="rag-persona-name"
                  className="text-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={form.name}
                />
                <label
                  className="field-label"
                  htmlFor="rag-persona-instructions"
                >
                  Instructions
                </label>
                <textarea
                  id="rag-persona-instructions"
                  className="text-area text-area--request"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  required
                  rows={5}
                  value={form.instructions}
                />
                <label
                  className="field-label"
                  htmlFor="rag-persona-capabilities"
                >
                  Capabilities
                </label>
                <textarea
                  id="rag-persona-capabilities"
                  className="text-area text-area--request"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      capabilities: event.target.value,
                    }))
                  }
                  placeholder="Describe what this persona can help with."
                  rows={4}
                  value={form.capabilities}
                />
                <div className="workspace-toolbar">
                  <button
                    className="primary-button"
                    disabled={
                      isSavingPersona ||
                      !form.name.trim() ||
                      !form.instructions.trim()
                    }
                    type="submit"
                  >
                    {isSavingPersona ? 'Saving...' : 'Save persona'}
                  </button>
                  {selectedPersona ? (
                    <button
                      className="secondary-button"
                      disabled={isSavingPersona}
                      onClick={handleDeletePersona}
                      type="button"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="section-card rag-documents-placeholder">
              <p className="card-kicker">Documents</p>
              <h3>Persona knowledge</h3>
              {selectedPersona ? (
                <>
                  <form className="invite-form" onSubmit={handleDocumentSubmit}>
                    <label className="field-label" htmlFor="rag-document-title">
                      Title
                    </label>
                    <input
                      id="rag-document-title"
                      className="text-input"
                      onChange={(event) =>
                        setDocumentForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      value={documentForm.title}
                    />
                    <label
                      className="field-label"
                      htmlFor="rag-document-source"
                    >
                      Source
                    </label>
                    <input
                      id="rag-document-source"
                      className="text-input"
                      onChange={(event) =>
                        setDocumentForm((current) => ({
                          ...current,
                          source: event.target.value,
                        }))
                      }
                      placeholder="Optional filename or source label"
                      value={documentForm.source}
                    />
                    <label className="field-label" htmlFor="rag-document-text">
                      Pasted text
                    </label>
                    <textarea
                      id="rag-document-text"
                      className="text-area text-area--compact"
                      onChange={(event) =>
                        setDocumentForm((current) => ({
                          ...current,
                          inputText: event.target.value,
                        }))
                      }
                      rows={4}
                      value={documentForm.inputText}
                    />
                    <label className="field-label" htmlFor="rag-document-file">
                      Text or PDF file
                    </label>
                    <input
                      id="rag-document-file"
                      accept=".txt,.pdf,text/plain,application/pdf"
                      className="text-input"
                      onChange={(event) =>
                        setDocumentForm((current) => ({
                          ...current,
                          file: event.target.files?.[0] || null,
                        }))
                      }
                      type="file"
                    />
                    <button
                      className="primary-button"
                      disabled={
                        isUploadingDocument ||
                        (!documentForm.inputText.trim() && !documentForm.file)
                      }
                      type="submit"
                    >
                      {isUploadingDocument ? 'Uploading...' : 'Upload document'}
                    </button>
                  </form>

                  {isLoadingDocuments ? (
                    <p className="section-detail">Loading documents.</p>
                  ) : documents.length === 0 ? (
                    <p className="section-detail">
                      No documents linked to this persona yet.
                    </p>
                  ) : (
                    <div className="rag-document-list">
                      {documents.map((document) => (
                        <article
                          className="rag-document-list-item"
                          key={document.document_id}
                        >
                          <div>
                            <strong>
                              {document.display_name ||
                                document.title ||
                                document.source}
                            </strong>
                            <span>
                              {document.chunk_count} chunks · {document.source}
                            </span>
                          </div>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              void handleRemoveDocument(document.document_id)
                            }
                            type="button"
                          >
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  <p className="section-detail">
                    Removing a document only removes it from this persona. The
                    reusable document and chunks are kept for dedupe.
                  </p>
                </>
              ) : (
                <p className="section-detail">
                  Select or create a persona before adding documents.
                </p>
              )}
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
