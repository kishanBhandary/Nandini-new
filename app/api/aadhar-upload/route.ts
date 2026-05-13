import { NextResponse } from 'next/server';
import { aadharBucketName, getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { forbiddenResponse, getValidSession, unauthorizedResponse } from '../../../lib/apiAuth';

async function ensureBucketExists() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Supabase storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { data, error } = await supabaseAdmin.storage.listBuckets();

  if (error) {
    throw new Error(error.message);
  }

  const bucketExists = data.some((bucket) => bucket.name === aadharBucketName);

  if (!bucketExists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(aadharBucketName, {
      public: true,
    });

    if (createError) {
      throw new Error(createError.message);
    }
  }
}

export async function POST(request: Request) {
  const session = await getValidSession();
  if (!session) return unauthorizedResponse();

  const canUpload =
    session.role === 'ADMIN' ||
    session.permissions.includes('create_customers') ||
    session.permissions.includes('edit_customers');

  if (!canUpload) {
    return forbiddenResponse();
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Aadhar image file is required.' }, { status: 400 });
    }

    await ensureBucketExists();

    const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = `aadhar-${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabaseAdmin.storage.from(aadharBucketName).upload(filePath, buffer, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(aadharBucketName).getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error('Aadhar upload error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload Aadhar image to Supabase.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}