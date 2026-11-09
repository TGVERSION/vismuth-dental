import { NextRequest, NextResponse } from 'next/server';
import { isBlockedInternalMlPath } from './proxy-path';

export function proxy(request: NextRequest) {
  if (isBlockedInternalMlPath(request.nextUrl.pathname)) {
    return NextResponse.json({ detail: 'Not Found' }, { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/ml/:path*' };
