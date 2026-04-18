import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

type UserRole = 'WORKER' | 'ADMIN';

type AuthUserRecord = {
  id: string;
  username: string;
  createdAt: Date;
};

const prismaAuth = prisma as unknown as {
  authUser: {
    findMany: (args: {
      where: { role: UserRole };
      select: { id: true; username: true; createdAt: true };
      orderBy: { createdAt: 'asc' | 'desc' };
    }) => Promise<AuthUserRecord[]>;
  };
};

export async function GET() {
  try {
    const admins = await prismaAuth.authUser.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ admins }, { status: 200 });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: 'Failed to load admins.' }, { status: 500 });
  }
}
