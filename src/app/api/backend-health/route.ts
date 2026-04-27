import { NextResponse } from 'next/server';

import { resolveBackendRootUrl } from '@/lib/config';

export async function GET() {
  const backendRootUrl = resolveBackendRootUrl();

  if (!backendRootUrl) {
    return NextResponse.json(
      { error: 'Backend root URL is not configured' },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${backendRootUrl}/health`, {
      cache: 'no-store',
    });

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
