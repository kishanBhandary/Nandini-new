import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

const db = prisma as unknown as {
  auditLog: {
    findMany: (args: {
      orderBy: { createdAt: 'desc' };
      take: number;
      skip: number;
      where?: Record<string, unknown>;
      include?: Record<string, boolean>;
    }) => Promise<Array<{
      id: string;
      userId: string | null;
      username: string;
      role: string;
      action: string;
      target: string | null;
      details: string | null;
      ipAddress: string | null;
      createdAt: Date;
    }>>;
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50));
    const action = searchParams.get('action') || undefined;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs.' }, { status: 500 });
  }
}
