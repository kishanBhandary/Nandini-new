import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requirePermission } from '../../../../../lib/apiAuth';

type RouteContext = {
  params: {
    id: string;
  };
};

// GET - Fetch refill history for a customer
export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('read_customers');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = context.params;

    const refills = await prisma.refill.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ refills });
  } catch (error) {
    console.error('Refill history error:', error);
    return NextResponse.json({ error: 'Failed to fetch refill history.' }, { status: 500 });
  }
}

// POST - Add a new refill
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('edit_customers');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = context.params;
    const body = await request.json();
    const { amount } = body;

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Please enter a valid refill amount.' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    const username = request.cookies.get('session_username')?.value || 'unknown';

    const refill = await prisma.refill.create({
      data: {
        customerId: id,
        amount,
        cylinderReturned: false,
        performedBy: username,
      },
    });

    return NextResponse.json({ refill, message: 'Refill added successfully.' }, { status: 201 });
  } catch (error) {
    console.error('Refill error:', error);
    return NextResponse.json({ error: 'Failed to add refill.' }, { status: 500 });
  }
}

// PATCH - Toggle cylinder returned status for a refill
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('edit_customers');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { refillId, cylinderReturned } = body;

    if (!refillId || typeof cylinderReturned !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const refill = await prisma.refill.findUnique({ where: { id: refillId } });
    if (!refill || refill.customerId !== context.params.id) {
      return NextResponse.json({ error: 'Refill not found.' }, { status: 404 });
    }

    const updated = await prisma.refill.update({
      where: { id: refillId },
      data: { cylinderReturned },
    });

    return NextResponse.json({ refill: updated, message: cylinderReturned ? 'Cylinder marked as returned.' : 'Cylinder marked as pending.' });
  } catch (error) {
    console.error('Refill update error:', error);
    return NextResponse.json({ error: 'Failed to update refill.' }, { status: 500 });
  }
}
