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
    const workers = await prismaAuth.authUser.findMany({
      where: { role: 'WORKER' },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ workers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching workers:', error);
    return NextResponse.json({ error: 'Failed to load workers.' }, { status: 500 });
  }
}
