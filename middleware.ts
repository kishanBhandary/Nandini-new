import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/worker/login')) {
    return NextResponse.next();
  }

  const sessionRole = request.cookies.get('session_role')?.value;

  if (pathname.startsWith('/admin')) {
    if (sessionRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (pathname.startsWith('/worker')) {
    if (sessionRole !== 'WORKER') {
      return NextResponse.redirect(new URL('/worker/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/worker/:path*'],
};
