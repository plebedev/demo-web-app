import { NextRequest, NextResponse } from 'next/server';

import { resolveBackendBaseUrl } from '@/lib/config';
import {
  buildUpstreamUrl,
  resolveUpstreamTimeoutMs,
  reverseProxy,
} from '@/lib/server/reverse-proxy';

async function proxyRequest(request: NextRequest, path: string[]) {
  const backendBaseUrl = resolveBackendBaseUrl();

  if (!backendBaseUrl) {
    return NextResponse.json(
      {
        error: 'Backend base URL is not configured',
      },
      { status: 503 },
    );
  }

  const targetUrl = buildUpstreamUrl(
    backendBaseUrl,
    path,
    request.nextUrl.searchParams,
  );
  if (!targetUrl) {
    return NextResponse.json({ error: 'Invalid proxy path' }, { status: 400 });
  }

  return reverseProxy(request, targetUrl, {
    timeoutMs: resolveUpstreamTimeoutMs(),
  });
}

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return handle(request, context);
}
