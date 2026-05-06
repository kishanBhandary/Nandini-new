import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

const db = prisma as unknown as {
  auditLog: {
    create: (args: {
      data: {
        username: string;
        role: string;
        action: string;
        target?: string;
        details?: string;
      };
    }) => Promise<unknown>;
  };
};

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const body = await request.json();
    const { refundAmount, reason } = body;

    // Validate refund amount
    if (typeof refundAmount !== 'number' || refundAmount < 0) {
      return NextResponse.json({ error: 'Valid refund amount is required.' }, { status: 400 });
    }

    // Get customer details
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    // Check if already cancelled
    const existingCancellation = await prisma.cancelledCylinder.findFirst({
      where: { customerId: id },
    });

    if (existingCancellation) {
      return NextResponse.json({ error: 'Cylinder already cancelled for this customer.' }, { status: 400 });
    }

    // Create cancellation record and update customer refund
    const result = await prisma.$transaction(async (tx) => {
      // Create cancelled cylinder record
      const cancelledCylinder = await tx.cancelledCylinder.create({
        data: {
          customerId: id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAadhar: customer.aadhar,
          gasType: customer.gasType,
          gasVariant: customer.gasVariant,
          depositAmount: customer.deposit,
          refundAmount: refundAmount,
          reason: reason || null,
        },
      });

      // Update customer refund
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { refund: refundAmount },
      });

      return { cancelledCylinder, updatedCustomer };
    });

    // Audit log
    const username = request.cookies.get('session_username')?.value || 'unknown';
    const role = request.cookies.get('session_role')?.value || 'ADMIN';
    await db.auditLog.create({
      data: {
        username,
        role,
        action: 'CANCEL_CYLINDER',
        target: customer.name,
        details: JSON.stringify({ customerId: id, refundAmount, reason }),
      },
    });

    return NextResponse.json(
      {
        cancelledCylinder: result.cancelledCylinder,
        customer: result.updatedCustomer,
        message: 'Cylinder cancelled successfully.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cancellation error:', error);
    return NextResponse.json({ error: 'Failed to cancel cylinder.' }, { status: 500 });
  }
}
