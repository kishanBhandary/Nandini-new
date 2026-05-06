import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim();
  const hasTransaction = url.searchParams.get('hasTransaction') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  const filters: Prisma.CustomerWhereInput[] = [];

  if (hasTransaction) {
    filters.push({
      OR: [{ deposit: { gt: 0 } }, { refund: { gt: 0 } }],
    });
  }

  if (search) {
    const searchClauses: Prisma.CustomerWhereInput[] = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { aadhar: { contains: search, mode: 'insensitive' } },
      // Cast keeps editor type-check stable when Prisma client cache lags behind schema updates.
      { address: { contains: search, mode: 'insensitive' } } as unknown as Prisma.CustomerWhereInput,
    ];

    filters.push({
      OR: searchClauses,
    });
  }

  const where: Prisma.CustomerWhereInput | undefined = filters.length > 0 ? { AND: filters } : undefined;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  const res = NextResponse.json({
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
  res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=10');
  return res;
}
