import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
    // Find duplicate Aadhar numbers
    const aadharDuplicates = await prisma.$queryRaw<Array<{ aadhar: string; count: bigint }>>`
      SELECT aadhar, COUNT(*) as count
      FROM "Customer"
      GROUP BY aadhar
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    // Find duplicate phone numbers
    const phoneDuplicates = await prisma.$queryRaw<Array<{ phone: string; count: bigint }>>`
      SELECT phone, COUNT(*) as count
      FROM "Customer"
      GROUP BY phone
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    // Get full customer details for duplicates
    const duplicateAadhars = aadharDuplicates.map(d => d.aadhar);
    const duplicatePhones = phoneDuplicates.map(d => d.phone);

    const aadharCustomers = duplicateAadhars.length > 0
      ? await prisma.customer.findMany({
          where: { aadhar: { in: duplicateAadhars } },
          orderBy: [{ aadhar: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, name: true, phone: true, aadhar: true, address: true, gasType: true, createdAt: true },
        })
      : [];

    const phoneCustomers = duplicatePhones.length > 0
      ? await prisma.customer.findMany({
          where: { phone: { in: duplicatePhones } },
          orderBy: [{ phone: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, name: true, phone: true, aadhar: true, address: true, gasType: true, createdAt: true },
        })
      : [];

    return NextResponse.json({
      duplicates: {
        aadhar: {
          count: aadharDuplicates.length,
          groups: aadharDuplicates.map(d => ({
            value: d.aadhar,
            count: Number(d.count),
            customers: aadharCustomers.filter(c => c.aadhar === d.aadhar),
          })),
        },
        phone: {
          count: phoneDuplicates.length,
          groups: phoneDuplicates.map(d => ({
            value: d.phone,
            count: Number(d.count),
            customers: phoneCustomers.filter(c => c.phone === d.phone),
          })),
        },
      },
    });
  } catch (error) {
    console.error('Duplicate detection API error:', error);
    return NextResponse.json({ error: 'Failed to check duplicates.' }, { status: 500 });
  }
}
