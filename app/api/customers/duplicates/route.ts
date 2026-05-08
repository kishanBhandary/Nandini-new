import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/apiAuth';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Get cancelled customer IDs to exclude them
    const cancelledRecords = await prisma.cancelledCylinder.findMany({
      select: { customerId: true },
    });
    const cancelledIds = cancelledRecords
      .map(r => r.customerId)
      .filter((id): id is string => id !== null);

    // Find duplicate Aadhar numbers (only active customers)
    const aadharDuplicates = cancelledIds.length > 0
      ? await prisma.$queryRaw<Array<{ aadhar: string; count: bigint }>>`
          SELECT aadhar, COUNT(*) as count
          FROM "Customer"
          WHERE id NOT IN (SELECT unnest(${cancelledIds}::text[]))
          GROUP BY aadhar
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `
      : await prisma.$queryRaw<Array<{ aadhar: string; count: bigint }>>`
          SELECT aadhar, COUNT(*) as count
          FROM "Customer"
          GROUP BY aadhar
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `;

    // Find duplicate phone numbers (only active customers)
    const phoneDuplicates = cancelledIds.length > 0
      ? await prisma.$queryRaw<Array<{ phone: string; count: bigint }>>`
          SELECT phone, COUNT(*) as count
          FROM "Customer"
          WHERE id NOT IN (SELECT unnest(${cancelledIds}::text[]))
          GROUP BY phone
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `
      : await prisma.$queryRaw<Array<{ phone: string; count: bigint }>>`
          SELECT phone, COUNT(*) as count
          FROM "Customer"
          GROUP BY phone
          HAVING COUNT(*) > 1
          ORDER BY count DESC
        `;

    // Get full customer details for duplicates (exclude cancelled)
    const duplicateAadhars = aadharDuplicates.map(d => d.aadhar);
    const duplicatePhones = phoneDuplicates.map(d => d.phone);

    const aadharCustomers = duplicateAadhars.length > 0
      ? await prisma.customer.findMany({
          where: {
            aadhar: { in: duplicateAadhars },
            ...(cancelledIds.length > 0 ? { id: { notIn: cancelledIds } } : {}),
          },
          orderBy: [{ aadhar: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, name: true, phone: true, aadhar: true, address: true, gasType: true, createdAt: true },
        })
      : [];

    const phoneCustomers = duplicatePhones.length > 0
      ? await prisma.customer.findMany({
          where: {
            phone: { in: duplicatePhones },
            ...(cancelledIds.length > 0 ? { id: { notIn: cancelledIds } } : {}),
          },
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
