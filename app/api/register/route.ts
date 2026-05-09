import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requirePermission } from '../../../lib/apiAuth';

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

export async function POST(request: NextRequest) {
  const auth = await requirePermission('create_customers');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { name, phone, aadhar, address, gasType, gasVariant, deposit, refund, aadharImageUrl } = body;

    if (!name || !phone || !aadhar || !address || !gasType || !gasVariant || deposit == null || refund == null) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const depositAmount = Number(deposit);
    const refundAmount = Number(refund);

    if (Number.isNaN(depositAmount) || depositAmount < 0 || Number.isNaN(refundAmount) || refundAmount < 0) {
      return NextResponse.json({ error: 'Deposit and refund must be valid non-negative numbers.' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        aadhar,
        address,
        gasType,
        gasVariant,
        deposit: depositAmount,
        refund: refundAmount,
        aadharImageUrl: aadharImageUrl ?? null,
      },
    });

    // Audit log
    const username = request.cookies.get('session_username')?.value || 'unknown';
    const role = request.cookies.get('session_role')?.value || 'WORKER';
    try {
      await db.auditLog.create({
        data: {
          username,
          role,
          action: 'CREATE_CUSTOMER',
          target: name,
          details: JSON.stringify({ customerId: customer.id, phone, aadhar }),
        },
      });
    } catch { /* don't fail registration if audit fails */ }

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json({ error: 'Failed to save registration.' }, { status: 500 });
  }
}
