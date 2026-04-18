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

    // Check if admin already exists
    const existingAdmin = await prismaAuth.authUser.findUnique({
      where: {
        username_role: {
          username,
          role: 'ADMIN',
        },
      },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Admin with this username already exists.' },
        { status: 400 }
      );
    }

    // Create new admin
    await prismaAuth.authUser.create({
      username,
      role: 'ADMIN',
      passwordHash: hashPassword(password),
    });

    return NextResponse.json(
      { success: true, message: `Admin '${username}' created successfully.` },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin.' },
      { status: 500 }
    );
  }
}
