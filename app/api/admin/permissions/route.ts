import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

type UserRole = 'WORKER' | 'ADMIN';

const VALID_PERMISSIONS = [
  'read_customers',
  'edit_customers',
  'cancel_cylinders',
  'create_customers',
  'view_dashboard',
  'manage_admins',
  'manage_workers',
  'view_audit_log',
  'manage_sessions',
  'view_duplicates',
] as const;

const db = prisma as unknown as {
  authUser: {
    findMany: (args: {
      select: { id: true; username: true; role: true; permissions: true; createdAt: true };
      orderBy: { createdAt: 'desc' };
    }) => Promise<Array<{
      id: string;
      username: string;
      role: UserRole;
      permissions: string[];
      createdAt: Date;
    }>>;
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ id: string; username: string; role: UserRole; permissions: string[] } | null>;
    update: (args: {
      where: { id: string };
      data: { permissions: string[] };
    }) => Promise<unknown>;
  };
  auditLog: {
    create: (args: {
      data: {
        userId?: string;
        username: string;
        role: string;
        action: string;
        target?: string;
        details?: string;
      };
    }) => Promise<unknown>;
  };
};

// Get all users with their permissions
export async function GET() {
  try {
    const users = await db.authUser.findMany({
      select: { id: true, username: true, role: true, permissions: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users, validPermissions: VALID_PERMISSIONS });
  } catch (error) {
    console.error('Permissions list error:', error);
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}

// Update a user's permissions
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const permissions = Array.isArray(body?.permissions) ? body.permissions : [];

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // Validate permissions
    const validPerms = permissions.filter((p: string) =>
      VALID_PERMISSIONS.includes(p as typeof VALID_PERMISSIONS[number])
    );

    const user = await db.authUser.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const oldPermissions = user.permissions || [];

    await db.authUser.update({
      where: { id: userId },
      data: { permissions: validPerms },
    });

    // Log permission change
    const adminUsername = request.cookies.get('session_username')?.value || 'unknown';
    const adminRole = request.cookies.get('session_role')?.value || 'ADMIN';

    await db.auditLog.create({
      data: {
        username: adminUsername,
        role: adminRole,
        action: 'PERMISSION_CHANGE',
        target: user.username,
        details: JSON.stringify({
          targetRole: user.role,
          from: oldPermissions,
          to: validPerms,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Permissions updated for '${user.username}'.`,
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    return NextResponse.json({ error: 'Failed to update permissions.' }, { status: 500 });
  }
}
