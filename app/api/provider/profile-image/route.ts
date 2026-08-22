import { NextRequest, NextResponse } from 'next/server';
import { decryptGoogleSession, GOOGLE_OAUTH_COOKIE } from '@/src/lib/google-oauth-server';
import {
  providerSlug,
  uploadProviderImage,
  WebflowConfigurationError,
} from '@/src/lib/webflow-server';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: NextRequest) {
  const session = decryptGoogleSession(request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value);
  if (!session?.email || !(session.expiresAt > Date.now()) || !session.email.toLowerCase().endsWith('@revrebel.io')) {
    return NextResponse.json({ error: 'An authorized REVREBEL account is required.' }, { status: 401 });
  }

  try {
    const body = await request.formData();
    const image = body.get('image');
    if (!(image instanceof File) || !ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ error: 'Choose a JPEG, PNG, WebP, or GIF image.' }, { status: 400 });
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'The image must be smaller than 4MB.' }, { status: 400 });
    }

    const slug = providerSlug(session.name, session.email);
    if (!slug) {
      return NextResponse.json({ error: 'Unable to determine the provider booking page.' }, { status: 400 });
    }

    const result = await uploadProviderImage({
      bytes: Buffer.from(await image.arrayBuffer()),
      contentType: image.type,
      fileName: `${slug}-${Date.now()}.${image.name.split('.').pop() || 'jpg'}`,
      slug,
      alt: session.name || 'REVREBEL team member',
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WebflowConfigurationError) {
      console.warn('[webflow] Profile image upload is not configured.', error.message);
      return NextResponse.json({ error: 'Profile image uploads are not configured.' }, { status: 503 });
    }
    console.error('[webflow] Unable to upload provider image.', error);
    return NextResponse.json({ error: 'The profile image could not be saved.' }, { status: 502 });
  }
}
