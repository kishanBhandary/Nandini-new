import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/apiAuth';

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

type ValidPermission = (typeof VALID_PERMISSIONS)[number];

function isValidPermission(value: unknown): value is ValidPermission {
  return typeof value === 'string' && VALID_PERMISSIONS.includes(value as ValidPermission);
}

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
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const users = await db.authUser.findMany({
      select: { id: true, username: true, role: true, permissions: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users, validPermissions: VALID_PERMISSIONS });
  } catch (error) {
    console.error('Permissions list error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P1001') {
      return NextResponse.json({ error: 'Database connection failed. Please check your Supabase connection and try again.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch users.' }, { status: 500 });
  }
}

// Update a user's permissions
export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const permissions: unknown[] = Array.isArray(body?.permissions) ? body.permissions : [];

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // Validate permissions
    const validPerms = permissions.filter(isValidPermission);

    // Permission dependencies:
    // Any operation/view capability that acts on customer records also needs read access.
    const normalizedPerms = new Set<ValidPermission>(validPerms);
    if (
      normalizedPerms.has('edit_customers') ||
      normalizedPerms.has('cancel_cylinders') ||
      normalizedPerms.has('create_customers') ||
      normalizedPerms.has('view_dashboard') ||
      normalizedPerms.has('view_duplicates')
    ) {
      normalizedPerms.add('read_customers');
    }
    const effectivePerms: string[] = Array.from(normalizedPerms);

    const user = await db.authUser.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const oldPermissions = user.permissions || [];

    await db.authUser.update({
      where: { id: userId },
      data: { permissions: effectivePerms },
    });

    // Log permission change
    const adminUsername = auth.username;
    const adminRole = auth.role;

    await db.auditLog.create({
      data: {
        username: adminUsername,
        role: adminRole,
        action: 'PERMISSION_CHANGE',
        target: user.username,
        details: JSON.stringify({
          targetRole: user.role,
          from: oldPermissions,
          to: effectivePerms,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Permissions updated for '${user.username}'.`,
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P1001') {
      return NextResponse.json({ error: 'Database connection failed. Please check your Supabase connection and try again.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to update permissions.' }, { status: 500 });
  }
}
