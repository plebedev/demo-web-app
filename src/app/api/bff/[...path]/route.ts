import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '@/lib/config';

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

  const targetUrl = new URL(
    path.join('/'),
    `${backendBaseUrl.replace(/\/$/, '')}/`,
  );
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', request.headers.get('host') || '');
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  headers.delete('host');

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.text(),
    redirect: 'manual',
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
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
