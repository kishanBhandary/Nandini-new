import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';

type SessionInfo = {
  sessionId: string;
  userId: string;
  username: string;
  role: 'ADMIN' | 'WORKER';
  permissions: string[];
};

const prismaSession = prisma as unknown as {
  session: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ id: string; userId: string; role: string; active: boolean; expiresAt: Date } | null>;
  };
  authUser: {
    findUnique: (args: {
      where: { id: string };
      select: { username: true; role: true; permissions: true };
    }) => Promise<{ username: string; role: 'ADMIN' | 'WORKER'; permissions: string[] } | null>;
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

  if (!sessionId || !sessionRole) {
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

    const user = await prismaSession.authUser.findUnique({
      where: { id: session.userId },
      select: { username: true, role: true, permissions: true },
    });

    if (!user || user.role !== session.role) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      username: user.username,
      role: session.role as 'ADMIN' | 'WORKER',
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
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
 * Require a specific permission. ADMIN always has access.
 */
export async function requirePermission(permission: string): Promise<SessionInfo | NextResponse> {
  const session = await getValidSession();
  if (!session) return unauthorizedResponse();
  if (session.role === 'ADMIN') return session;
  if (!session.permissions.includes(permission)) return forbiddenResponse();
  return session;
}

/**
 * Require ADMIN role. Returns session info or sends 401/403.
 */
export async function requireAdmin(): Promise<SessionInfo | NextResponse> {
  return requireRole('ADMIN');
}
