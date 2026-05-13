import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requirePermission } from '../../../../../lib/apiAuth';
import { aadharBucketName, getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';

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

function parseAadharImageUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3);
      }
    } catch {
      return [];
    }
  }

  return [trimmed];
}

function encodeAadharImageUrls(urls: string[]): string | null {
  const normalized = urls.filter((url) => typeof url === 'string' && url.trim().length > 0).slice(0, 3);
  if (normalized.length === 0) return null;
  if (normalized.length === 1) return normalized[0];
  return JSON.stringify(normalized);
}

function getStoragePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${aadharBucketName}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const encodedPath = parsed.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requirePermission('edit_customers');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = context.params;
    const body = await request.json();
    const { name, phone, aadhar, address, gasType, gasVariant, deposit, refund, performedBy, aadharImages } = body;

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

    if (aadharImages !== undefined) {
      const nextImages = Array.isArray(aadharImages)
        ? aadharImages.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3)
        : [];
      const prevImages = parseAadharImageUrls(customer.aadharImageUrl);

      const areSame =
        prevImages.length === nextImages.length &&
        prevImages.every((url, index) => url === nextImages[index]);

      if (!areSame) {
        changes.aadharImages = { from: prevImages, to: nextImages };
        updateData.aadharImageUrl = encodeAadharImageUrls(nextImages);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes detected.' }, { status: 400 });
    }

    const previousAadharImages = parseAadharImageUrls(customer.aadharImageUrl);

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

    // Remove old files that were replaced/removed in edit mode.
    const nextAadharImages = parseAadharImageUrls(result.aadharImageUrl);
    const removedPublicUrls = previousAadharImages.filter((url) => !nextAadharImages.includes(url));
    if (removedPublicUrls.length > 0) {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        const pathsToDelete = removedPublicUrls
          .map((url) => getStoragePathFromPublicUrl(url))
          .filter((path): path is string => Boolean(path));

        if (pathsToDelete.length > 0) {
          const { error } = await supabaseAdmin.storage.from(aadharBucketName).remove(pathsToDelete);
          if (error) {
            console.error('Aadhar cleanup warning:', error.message);
          }
        }
      }
    }

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
