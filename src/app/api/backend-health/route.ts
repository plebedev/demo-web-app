import { NextResponse } from 'next/server';

import { resolveBackendRootUrl } from '@/lib/config';
import {
  fetchUpstream,
  resolveUpstreamTimeoutMs,
} from '@/lib/server/reverse-proxy';

export async function GET(request: Request) {
  const backendRootUrl = resolveBackendRootUrl();

  if (!backendRootUrl) {
    return NextResponse.json(
      { error: 'Backend root URL is not configured' },
      { status: 503 },
    );
  }

  try {
    const response = await fetchUpstream(`${backendRootUrl}/health`, {
      method: 'GET',
      headers: new Headers(),
      redirect: 'follow',
      // Cancel the probe if the caller goes away.
      signal: request?.signal,
      timeoutMs: resolveUpstreamTimeoutMs(),
    });
    // Only the status matters; release the body without reading it.
    await response.body?.cancel().catch(() => {});

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend health check failed with ${response.status}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Backend health endpoint is unreachable' },
      { status: 503 },
    );
  }
}
