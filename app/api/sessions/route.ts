import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/apiAuth';

const db = prisma as unknown as {
  session: {
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy: { createdAt: 'desc' };
      include: { user: { select: { username: true; role: true } } };
    }) => Promise<Array<{
      id: string;
      userId: string;
      role: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: Date;
      expiresAt: Date;
      active: boolean;
      user: { username: string; role: string };
    }>>;
    update: (args: {
      where: { id: string };
      data: { active: boolean };
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { id: string };
      include: { user: { select: { username: true; role: true } } };
    }) => Promise<{ id: string; userId: string; user: { username: string; role: string } } | null>;
  };
  auditLog: {
    create: (args: {
      data: {
        userId?: string;
        username: string;
        role: string;
        action: string;
        target?: string;
        details?: string;
        ipAddress?: string;
      };
    }) => Promise<unknown>;
  };
};

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const sessions = await db.session.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { username: true, role: true } } },
    });

    // Filter out expired sessions
    const now = new Date();
    const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);

    return NextResponse.json({ sessions: activeSessions });
  } catch (error) {
    console.error('Sessions error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions.' }, { status: 500 });
  }
}

// Force logout a session
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { username: true, role: true } } },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    await db.session.update({
      where: { id: sessionId },
      data: { active: false },
    });

    // Get the admin performing the force logout from cookie
    const adminUsername = request.cookies.get('session_username')?.value || 'unknown';
    const adminRole = request.cookies.get('session_role')?.value || 'ADMIN';

    await db.auditLog.create({
      data: {
        username: adminUsername,
        role: adminRole,
        action: 'FORCE_LOGOUT',
        target: session.user.username,
        details: JSON.stringify({ sessionId, targetRole: session.user.role }),
      },
    });

    return NextResponse.json({ success: true, message: `Session for '${session.user.username}' terminated.` });
  } catch (error) {
    console.error('Force logout error:', error);
    return NextResponse.json({ error: 'Failed to terminate session.' }, { status: 500 });
  }
}
