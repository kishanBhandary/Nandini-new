import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth';
import { requireAdmin } from '../../../../lib/apiAuth';

type UserRole = 'WORKER' | 'ADMIN';

const DEFAULT_WORKER_PERMISSIONS = [
  'read_customers',
  'create_customers',
  'edit_customers',
  'cancel_cylinders',
] as const;

const prismaAuth = prisma as unknown as {
  authUser: {
    findUnique: (args: {
      where: { username_role: { username: string; role: UserRole } };
    }) => Promise<{ role: UserRole; passwordHash: string } | null>;
    create: (args: {
      data: { username: string; role: UserRole; passwordHash: string; permissions: string[] };
    }) => Promise<unknown>;
  };
  auditLog: {
    create: (args: {
      data: {
        username: string;
        role: string;
        action: string;
        target?: string;
      };
    }) => Promise<unknown>;
  };
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    const existingWorker = await prismaAuth.authUser.findUnique({
      where: {
        username_role: {
          username,
          role: 'WORKER',
        },
      },
    });

    if (existingWorker) {
      return NextResponse.json(
        { error: 'Worker with this username already exists.' },
        { status: 400 }
      );
    }

    await prismaAuth.authUser.create({
      data: {
        username,
        role: 'WORKER',
        passwordHash: await hashPassword(password),
        permissions: [...DEFAULT_WORKER_PERMISSIONS],
      },
    });

    // Audit log
    const adminUsername = request.cookies.get('session_username')?.value || 'unknown';
    await prismaAuth.auditLog.create({
      data: {
        username: adminUsername,
        role: 'ADMIN',
        action: 'CREATE_WORKER',
        target: username,
      },
    });

    return NextResponse.json(
      { success: true, message: `Worker '${username}' created successfully.` },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating worker:', error);
    return NextResponse.json(
      { error: 'Failed to create worker.' },
      { status: 500 }
    );
  }
}
