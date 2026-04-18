import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function POST(request: Request) {
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

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json({ error: 'Failed to save registration.' }, { status: 500 });
  }
}
