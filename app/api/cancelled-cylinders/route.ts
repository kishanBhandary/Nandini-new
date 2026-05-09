import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requirePermission } from '../../../lib/apiAuth';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('read_customers');
  if (auth instanceof NextResponse) return auth;

  try {
    const cancelledCylinders = await prisma.cancelledCylinder.findMany({
      orderBy: {
        cancelledAt: 'desc',
      },
    });

    const res = NextResponse.json({ cancelledCylinders, message: 'Cancelled cylinders fetched successfully.' });
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
    return res;
  } catch (error) {
    console.error('Fetch cancelled cylinders error:', error);
    return NextResponse.json({ error: 'Failed to fetch cancelled cylinders.' }, { status: 500 });
  }
}
