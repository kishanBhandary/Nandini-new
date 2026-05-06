import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const pendingRefills = await prisma.refill.findMany({
      where: { cylinderReturned: false },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            aadhar: true,
            gasType: true,
            gasVariant: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ pendingRefills });
  } catch (error) {
    console.error('Pending cylinders error:', error);
    return NextResponse.json({ error: 'Failed to fetch pending cylinders.' }, { status: 500 });
  }
}
