import { afterEach, describe, expect, it, vi } from 'vitest';

import { submitInviteRequest, verifyAccessToken } from '@/lib/api/access';
import {
  getPerspectiveView,
  ingestArtifactText,
  uploadArtifactFile,
} from '@/lib/api/context';
import { ApiError } from '@/lib/api/http';
import {
  createRagPersona,
  deleteRagPersona,
  uploadRagPersonaDocument,
} from '@/lib/api/rag';
import { createRun, ingestRun, submitRun } from '@/lib/api/runs';
import { getBackendHealth, getFeatureStatus } from '@/lib/api/status';
import { deactivateVoicePersona, getVoiceConfig } from '@/lib/api/voice';

type Call = [string, RequestInit | undefined];

function stubFetch(response: () => Response) {
  const mock = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async () => response());
  vi.stubGlobal('fetch', mock);
  return mock;
}

function onlyCall(mock: ReturnType<typeof stubFetch>): Call {
  expect(mock).toHaveBeenCalledTimes(1);
  return mock.mock.calls[0] as unknown as Call;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API operations keep the existing BFF contracts', () => {
  it('verifies access tokens with a bearer header', async () => {
    const fetchMock = stubFetch(() =>
      Response.json({ experience_id: 'rag-demo', expires_at: 'soon' }),
    );
    await verifyAccessToken('abc');
    const [url, init] = onlyCall(fetchMock);
    expect(url).toBe('/api/bff/access/verify');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer abc');
  });

  it('treats an empty invite-request success as success', async () => {
    stubFetch(() => new Response('accepted', { status: 202 }));
    await expect(
      submitInviteRequest({
        name: 'n',
        email: 'e',
        reason: 'r',
        experience_id: 'voice-demo',
      }),
    ).resolves.toBeNull();
  });

  it('creates runs with an empty JSON object and submits without a body', async () => {
    let fetchMock = stubFetch(() => Response.json({ id: 9 }));
    await createRun('tok');
    let [url, init] = onlyCall(fetchMock);
    expect(url).toBe('/api/bff/runs');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{}');

    fetchMock = stubFetch(() => Response.json({ id: 9 }));
    await submitRun('tok', 9);
    [url, init] = onlyCall(fetchMock);
    expect(url).toBe('/api/bff/runs/9/submit');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('uploads multipart bodies without a content type', async () => {
    const form = new FormData();
    form.set('input_text', 'hi');

    for (const send of [
      () => ingestRun('tok', 7, form),
      () => uploadRagPersonaDocument('tok', 21, form),
      () => uploadArtifactFile('tok', 'job_search', form),
    ]) {
      const fetchMock = stubFetch(() => Response.json({ id: 1 }));
      await send();
      const [, init] = onlyCall(fetchMock);
      expect(init?.body).toBe(form);
      const headers = new Headers(init?.headers);
      expect(headers.has('Content-Type')).toBe(false);
      expect(headers.get('Authorization')).toBe('Bearer tok');
    }
  });

  it('keeps context URLs, including explicit regeneration', async () => {
    let fetchMock = stubFetch(() => Response.json({ view: {} }));
    await getPerspectiveView('tok', 'job_search', 'role_fit', {
      regenerate: true,
    });
    expect(onlyCall(fetchMock)[0]).toBe(
      '/api/bff/context/domains/job_search/views/role_fit?regenerate=true',
    );

    fetchMock = stubFetch(() => Response.json({ view: {} }));
    await getPerspectiveView('tok', 'job_search', 'role_fit');
    expect(onlyCall(fetchMock)[0]).toBe(
      '/api/bff/context/domains/job_search/views/role_fit',
    );

    fetchMock = stubFetch(() => Response.json({ artifact: {} }));
    await ingestArtifactText('tok', 'job_search', {
      artifact_type_id: 'resume',
      title: null,
      text: 'body',
      source_uri: null,
      metadata: {},
    });
    const [url, init] = onlyCall(fetchMock);
    expect(url).toBe('/api/bff/context/domains/job_search/artifacts');
    expect(JSON.parse(String(init?.body))).toEqual({
      artifact_type_id: 'resume',
      title: null,
      text: 'body',
      source_uri: null,
      metadata: {},
    });
  });

  it('handles bodiless successes for deletes and deactivation', async () => {
    let fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    await expect(deleteRagPersona('tok', 11)).resolves.toBeUndefined();
    expect(onlyCall(fetchMock)[1]?.method).toBe('DELETE');

    fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    await expect(deactivateVoicePersona('tok', 7)).resolves.toBeUndefined();
    expect(onlyCall(fetchMock)[0]).toBe('/api/bff/voice/personas/7/deactivate');
  });

  it('maps unreadable mutation bodies to null for the caller to report', async () => {
    stubFetch(() => new Response('', { status: 201 }));
    await expect(
      createRagPersona('tok', {
        name: 'n',
        instructions: 'i',
        capabilities: null,
        tool_config: null,
      }),
    ).resolves.toBeNull();
  });

  it('returns null for a missing voice config but surfaces other errors', async () => {
    stubFetch(() => Response.json({ detail: 'none' }, { status: 404 }));
    await expect(getVoiceConfig('tok')).resolves.toBeNull();

    stubFetch(() => Response.json({ detail: 'down' }, { status: 500 }));
    await expect(getVoiceConfig('tok')).rejects.toBeInstanceOf(ApiError);
  });

  it('probes health anonymously and status with a token', async () => {
    let fetchMock = stubFetch(() => Response.json({ status: 'ok' }));
    await getBackendHealth();
    let [url, init] = onlyCall(fetchMock);
    expect(url).toBe('/api/backend-health');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);

    fetchMock = stubFetch(() => Response.json({ features: {} }));
    await getFeatureStatus('tok');
    [url, init] = onlyCall(fetchMock);
    expect(url).toBe('/api/bff/status');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok');
  });
});
