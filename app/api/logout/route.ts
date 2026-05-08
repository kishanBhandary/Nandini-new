import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

const prismaSession = prisma as unknown as {
  session: {
    update: (args: {
      where: { id: string };
      data: { active: boolean };
    }) => Promise<unknown>;
  };
  auditLog: {
    create: (args: {
      data: {
        userId?: string;
        username: string;
        role: string;
        action: string;
        ipAddress?: string;
      };
    }) => Promise<unknown>;
  };
};

export async function POST(request: Request) {
  try {
    const sessionId = request.headers.get('cookie')
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('session_id='))
      ?.split('=')[1];

    const sessionUsername = request.headers.get('cookie')
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('session_username='))
      ?.split('=')[1];

    const sessionRole = request.headers.get('cookie')
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('session_role='))
      ?.split('=')[1];

    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;

    // Deactivate session in DB
    if (sessionId) {
      try {
        await prismaSession.session.update({
          where: { id: sessionId },
          data: { active: false },
        });
      } catch {
        // Session may already be expired/deleted
      }
    }

    // Log audit event
    if (sessionUsername) {
      await prismaSession.auditLog.create({
        data: {
          username: decodeURIComponent(sessionUsername),
          role: sessionRole || 'UNKNOWN',
          action: 'LOGOUT',
          ipAddress,
        },
      });
    }

    const response = NextResponse.json({ success: true });

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    };

    response.cookies.set('session_role', '', cookieOpts);
    response.cookies.set('session_id', '', cookieOpts);
    response.cookies.set('session_username', '', cookieOpts);
    response.cookies.set('session_permissions', '', cookieOpts);

    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json({ error: 'Logout failed.' }, { status: 500 });
  }
}
