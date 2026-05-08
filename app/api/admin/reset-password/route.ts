import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth';
import { requireAdmin } from '../../../../lib/apiAuth';

type UserRole = 'WORKER' | 'ADMIN';

const prismaAuth = prisma as unknown as {
  authUser: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ id: string; username: string; role: UserRole } | null>;
    update: (args: {
      where: { id: string };
      data: { passwordHash: string };
    }) => Promise<unknown>;
  };
  auditLog: {
    create: (args: {
      data: {
        username: string;
        role: string;
        action: string;
        target: string;
        ipAddress?: string;
      };
    }) => Promise<unknown>;
  };
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'User ID and new password are required.' }, { status: 400 });
    }

    if (newPassword.length < 3) {
      return NextResponse.json({ error: 'Password must be at least 3 characters long.' }, { status: 400 });
    }

    // Check if user exists
    const user = await prismaAuth.authUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prismaAuth.authUser.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Log the action
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;

    await prismaAuth.auditLog.create({
      data: {
        username: auth.username,
        role: auth.role,
        action: 'RESET_PASSWORD',
        target: `${user.role}:${user.username}`,
        ipAddress,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: `Password reset successfully for ${user.role.toLowerCase()}: ${user.username}` 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
