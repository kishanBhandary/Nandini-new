import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { hashPassword, verifyPassword } from '../../../lib/auth';

type UserRole = 'WORKER' | 'ADMIN';

const DEFAULT_WORKER_PERMISSIONS = [
  'read_customers',
  'create_customers',
  'edit_customers',
  'cancel_cylinders',
] as const;

const prismaAuth = prisma as unknown as {
  authUser: {
    upsert: (args: {
      where: { username_role: { username: string; role: UserRole } };
      update: Record<string, never>;
      create: { username: string; role: UserRole; passwordHash: string };
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { username_role: { username: string; role: UserRole } };
    }) => Promise<{ id: string; role: UserRole; passwordHash: string; permissions: string[] } | null>;
    update: (args: {
      where: { id: string };
      data: { permissions: string[] };
    }) => Promise<unknown>;
  };
  session: {
    create: (args: {
      data: {
        userId: string;
        role: UserRole;
        ipAddress?: string;
        userAgent?: string;
        expiresAt: Date;
      };
    }) => Promise<{ id: string }>;
  };
  auditLog: {
    create: (args: {
      data: {
        userId: string;
        username: string;
        role: string;
        action: string;
        ipAddress?: string;
      };
    }) => Promise<unknown>;
  };
};

let defaultUsersCreated = false;

async function ensureDefaultUsers() {
  if (defaultUsersCreated) return;

  const defaultWorkerUsername = process.env.WORKER_USERNAME;
  const defaultWorkerPassword = process.env.WORKER_PASSWORD;
  const defaultAdminUsername = process.env.ADMIN_USERNAME;
  const defaultAdminPassword = process.env.ADMIN_PASSWORD;

  // Skip creating default users if environment variables are not set
  if (!defaultWorkerUsername || !defaultWorkerPassword || !defaultAdminUsername || !defaultAdminPassword) {
    return;
  }

  const [workerHash, adminHash] = await Promise.all([
    hashPassword(defaultWorkerPassword),
    hashPassword(defaultAdminPassword),
  ]);

  await Promise.all([
    prismaAuth.authUser.upsert({
      where: { username_role: { username: defaultWorkerUsername, role: 'WORKER' } },
      update: {},
      create: { username: defaultWorkerUsername, role: 'WORKER', passwordHash: workerHash },
    }),
    prismaAuth.authUser.upsert({
      where: { username_role: { username: defaultAdminUsername, role: 'ADMIN' } },
      update: {},
      create: { username: defaultAdminUsername, role: 'ADMIN', passwordHash: adminHash },
    }),
  ]);

  defaultUsersCreated = true;
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

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    let effectivePermissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (user.role === 'WORKER' && effectivePermissions.length === 0) {
      effectivePermissions = [...DEFAULT_WORKER_PERMISSIONS];
      await prismaAuth.authUser.update({
        where: { id: user.id },
        data: { permissions: effectivePermissions },
      });
    }

    // Get IP & user agent
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create session
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    const session = await prismaAuth.session.create({
      data: {
        userId: user.id,
        role: user.role,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Log audit event
    await prismaAuth.auditLog.create({
      data: {
        userId: user.id,
        username,
        role: user.role,
        action: 'LOGIN',
        ipAddress,
      },
    });

    const response = NextResponse.json({ success: true, role: user.role, permissions: effectivePermissions });

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    };

    response.cookies.set('session_role', user.role, cookieOpts);
    response.cookies.set('session_id', session.id, cookieOpts);
    response.cookies.set('session_username', username, cookieOpts);
    response.cookies.set('session_permissions', JSON.stringify(effectivePermissions), cookieOpts);

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
