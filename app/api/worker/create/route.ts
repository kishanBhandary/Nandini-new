import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth';

type UserRole = 'WORKER' | 'ADMIN';

const prismaAuth = prisma as unknown as {
  authUser: {
    findUnique: (args: {
      where: { username_role: { username: string; role: UserRole } };
    }) => Promise<{ role: UserRole; passwordHash: string } | null>;
    create: (args: {
      username: string;
      role: UserRole;
      passwordHash: string;
    }) => Promise<unknown>;
  };
};

export async function POST(request: Request) {
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
      username,
      role: 'WORKER',
      passwordHash: await hashPassword(password),
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
