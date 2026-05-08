import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';

type SessionInfo = {
  sessionId: string;
  userId: string;
  username: string;
  role: 'ADMIN' | 'WORKER';
};

const prismaSession = prisma as unknown as {
  session: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ id: string; userId: string; role: string; active: boolean; expiresAt: Date } | null>;
  };
};

/**
 * Validates the current session from cookies against the database.
 * Returns session info if valid, or null if invalid/expired.
 */
export async function getValidSession(): Promise<SessionInfo | null> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  const sessionRole = cookieStore.get('session_role')?.value;
  const sessionUsername = cookieStore.get('session_username')?.value;

  if (!sessionId || !sessionRole || !sessionUsername) {
    return null;
  }

  try {
    const session = await prismaSession.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.active || session.expiresAt < new Date()) {
      return null;
    }

    if (session.role !== sessionRole) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      username: decodeURIComponent(sessionUsername),
      role: session.role as 'ADMIN' | 'WORKER',
    };
  } catch {
    return null;
  }
}

/**
 * Returns 401 JSON response for unauthenticated requests.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
}

/**
 * Returns 403 JSON response for insufficient permissions.
 */
export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden. Insufficient permissions.' }, { status: 403 });
}

/**
 * Require a valid session. Returns session info or sends 401.
 */
export async function requireAuth(): Promise<SessionInfo | NextResponse> {
  const session = await getValidSession();
  if (!session) return unauthorizedResponse();
  return session;
}

/**
 * Require a specific role. Returns session info or sends 401/403.
 */
export async function requireRole(role: 'ADMIN' | 'WORKER'): Promise<SessionInfo | NextResponse> {
  const session = await getValidSession();
  if (!session) return unauthorizedResponse();
  if (session.role !== role) return forbiddenResponse();
  return session;
}

/**
 * Require ADMIN role. Returns session info or sends 401/403.
 */
export async function requireAdmin(): Promise<SessionInfo | NextResponse> {
  return requireRole('ADMIN');
}
