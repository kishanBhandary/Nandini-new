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

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;
    const body = await request.json();
    const { name, phone, aadhar, address, gasType, gasVariant, deposit, refund, performedBy } = body;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    // Build changes object for activity log
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const updateData: Record<string, unknown> = {};

    if (name !== undefined && name !== customer.name) {
      changes.name = { from: customer.name, to: name };
      updateData.name = name;
    }
    if (phone !== undefined && phone !== customer.phone) {
      changes.phone = { from: customer.phone, to: phone };
      updateData.phone = phone;
    }
    if (aadhar !== undefined && aadhar !== customer.aadhar) {
      changes.aadhar = { from: customer.aadhar, to: aadhar };
      updateData.aadhar = aadhar;
    }
    if (address !== undefined && address !== customer.address) {
      changes.address = { from: customer.address, to: address };
      updateData.address = address;
    }
    if (gasType !== undefined && gasType !== customer.gasType) {
      changes.gasType = { from: customer.gasType, to: gasType };
      updateData.gasType = gasType;
    }
    if (gasVariant !== undefined && gasVariant !== customer.gasVariant) {
      changes.gasVariant = { from: customer.gasVariant, to: gasVariant };
      updateData.gasVariant = gasVariant;
    }
    if (deposit !== undefined) {
      const depNum = Number(deposit);
      if (!isNaN(depNum) && depNum >= 0 && depNum !== customer.deposit) {
        changes.deposit = { from: customer.deposit, to: depNum };
        updateData.deposit = depNum;
      }
    }
    if (refund !== undefined) {
      const refNum = Number(refund);
      if (!isNaN(refNum) && refNum >= 0 && refNum !== customer.refund) {
        changes.refund = { from: customer.refund, to: refNum };
        updateData.refund = refNum;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes detected.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: updateData,
      });

      await tx.activityLog.create({
        data: {
          customerId: id,
          action: 'EDIT',
          changes: JSON.stringify(changes),
          performedBy: typeof performedBy === 'string' ? performedBy : null,
        },
      });

      return updated;
    });

    // Audit log
    const username = request.cookies.get('session_username')?.value || performedBy || 'unknown';
    const role = request.cookies.get('session_role')?.value || 'ADMIN';
    await db.auditLog.create({
      data: {
        username,
        role,
        action: 'EDIT_CUSTOMER',
        target: customer.name,
        details: JSON.stringify(changes),
      },
    });

    return NextResponse.json({ success: true, customer: result });
  } catch (error) {
    console.error('Edit customer API error:', error);
    return NextResponse.json({ error: 'Failed to update customer.' }, { status: 500 });
  }
}
