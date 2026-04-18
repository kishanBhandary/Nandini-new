import { NextResponse } from 'next/server';
import { aadharBucketName, supabaseAdmin } from '../../../lib/supabaseAdmin';

async function ensureBucketExists() {
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
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aadhar image file is required.' }, { status: 400 });
    }

    await ensureBucketExists();

    const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = `aadhar-${Date.now()}-${safeName}`;

    const { data, error } = await supabaseAdmin.storage.from(aadharBucketName).upload(filePath, file, {
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
    return NextResponse.json({ error: 'Failed to upload Aadhar image to Supabase.' }, { status: 500 });
  }
}