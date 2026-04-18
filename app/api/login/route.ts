import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { hashPassword, verifyPassword } from '../../../lib/auth';

type UserRole = 'WORKER' | 'ADMIN';

const prismaAuth = prisma as unknown as {
  authUser: {
    upsert: (args: {
      where: { username_role: { username: string; role: UserRole } };
      update: Record<string, never>;
      create: { username: string; role: UserRole; passwordHash: string };
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { username_role: { username: string; role: UserRole } };
    }) => Promise<{ role: UserRole; passwordHash: string } | null>;
  };
};

async function ensureDefaultUsers() {
  const defaultWorkerUsername = process.env.WORKER_USERNAME;
  const defaultWorkerPassword = process.env.WORKER_PASSWORD;
  const defaultAdminUsername = process.env.ADMIN_USERNAME;
  const defaultAdminPassword = process.env.ADMIN_PASSWORD;

  // Skip creating default users if environment variables are not set
  if (!defaultWorkerUsername || !defaultWorkerPassword || !defaultAdminUsername || !defaultAdminPassword) {
    return;
  }

  await prismaAuth.authUser.upsert({
    where: {
      username_role: {
        username: defaultWorkerUsername,
        role: 'WORKER',
      },
    },
    update: {},
    create: {
      username: defaultWorkerUsername,
      role: 'WORKER',
      passwordHash: hashPassword(defaultWorkerPassword),
    },
  });

  await prismaAuth.authUser.upsert({
    where: {
      username_role: {
        username: defaultAdminUsername,
        role: 'ADMIN',
      },
    },
    update: {},
    create: {
      username: defaultAdminUsername,
      role: 'ADMIN',
      passwordHash: hashPassword(defaultAdminPassword),
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = body?.role as UserRole;

    if (!username || !password || (role !== 'WORKER' && role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Username, password and role are required.' }, { status: 400 });
    }

    await ensureDefaultUsers();

    const user = await prismaAuth.authUser.findUnique({
      where: {
        username_role: {
          username,
          role,
        },
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, role: user.role });
    response.cookies.set('session_role', user.role, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
