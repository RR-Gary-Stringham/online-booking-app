import { createHash } from 'node:crypto';
import type { BookingPageContent } from '../types';

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2';
const USER_IMAGE_FIELD = 'user';

interface WebflowImageValue {
  fileId?: string;
  url?: string;
  alt?: string;
}

interface WebflowCollectionItem {
  id: string;
  fieldData: Record<string, unknown>;
}

interface WebflowItemList {
  items: WebflowCollectionItem[];
  pagination?: { limit: number; offset: number; total: number };
}

interface WebflowAssetUpload {
  id: string;
  uploadUrl: string;
  uploadDetails: Record<string, string>;
  hostedUrl?: string;
  assetUrl?: string;
}

export class WebflowConfigurationError extends Error {
  constructor(name: string) {
    super(`Required Webflow configuration is missing: ${name}.`);
    this.name = 'WebflowConfigurationError';
  }
}

function requireWebflowEnv(
  name: 'BOOKING_CALENDAR_API_KEY' | 'WEBFLOW_BOOKING_COLLECTION_ID' | 'WEBFLOW_SITE_ID',
) {
  const value = process.env[name]?.trim();
  if (!value) throw new WebflowConfigurationError(name);
  return value;
}

function webflowHeaders() {
  return {
    Authorization: `Bearer ${requireWebflowEnv('BOOKING_CALENDAR_API_KEY')}`,
    'Content-Type': 'application/json',
  };
}

async function webflowJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...webflowHeaders(), ...init?.headers },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Webflow API request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function fieldString(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  return typeof value === 'string' ? value : '';
}

function fieldBoolean(fields: Record<string, unknown>, key: string) {
  return fields[key] === true;
}

function imageUrl(fields: Record<string, unknown>) {
  const image = fields[USER_IMAGE_FIELD] as WebflowImageValue | undefined;
  return image && typeof image.url === 'string' ? image.url : undefined;
}

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function providerSlug(name: string | undefined, email: string | undefined) {
  const nameSlug = slugify(name ?? '');
  if (nameSlug) return nameSlug;
  return slugify(email?.split('@')[0] ?? '');
}

export async function findBookingPageItem(slug: string, live = true) {
  const collectionId = requireWebflowEnv('WEBFLOW_BOOKING_COLLECTION_ID');
  const endpoint = live ? 'items/live' : 'items';
  let offset = 0;

  do {
    const result = await webflowJson<WebflowItemList>(
      `${WEBFLOW_API_BASE}/collections/${collectionId}/${endpoint}?limit=100&offset=${offset}`,
    );
    const match = result.items.find((item) => {
      const fields = item.fieldData;
      return fields.slug === slug || fields['meeting-template'] === slug;
    });
    if (match) return match;

    const total = result.pagination?.total ?? result.items.length;
    offset += result.pagination?.limit ?? 100;
    if (offset >= total) return null;
  } while (true);
}

export async function bookingPageContent(slug: string): Promise<BookingPageContent | null> {
  const item = await findBookingPageItem(slug, true);
  if (!item) return null;
  const fields = item.fieldData;

  return {
    slug: fieldString(fields, 'slug') || slug,
    meetingTemplate: fieldString(fields, 'meeting-template') || slug,
    firstName: fieldString(fields, 'first-name'),
    lastName: fieldString(fields, 'last-name'),
    templateName: fieldString(fields, 'template-name'),
    eyebrow: fieldString(fields, 'meeting-template-eyebrow'),
    headline: fieldString(fields, 'meeting-template-headline'),
    subheadline: fieldString(fields, 'meeting-template-subheadline'),
    description: fieldString(fields, 'meeting-template-description'),
    isUserTemplate: fieldBoolean(fields, 'is-user-template'),
    userImageUrl: imageUrl(fields),
  };
}

export async function uploadProviderImage(input: {
  bytes: Buffer;
  contentType: string;
  fileName: string;
  slug: string;
  alt: string;
}) {
  const item = await findBookingPageItem(input.slug, false);
  if (!item) throw new Error('No matching provider booking page was found.');

  const siteId = requireWebflowEnv('WEBFLOW_SITE_ID');
  const asset = await webflowJson<WebflowAssetUpload>(`${WEBFLOW_API_BASE}/sites/${siteId}/assets`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: input.fileName.slice(0, 99),
      fileHash: createHash('md5').update(input.bytes).digest('hex'),
    }),
  });

  const uploadBody = new FormData();
  Object.entries(asset.uploadDetails).forEach(([key, value]) => uploadBody.append(key, value));
  uploadBody.append('file', new Blob([input.bytes], { type: input.contentType }), input.fileName);

  const uploadResponse = await fetch(asset.uploadUrl, { method: 'POST', body: uploadBody });
  if (!uploadResponse.ok) {
    throw new Error(`Webflow asset upload failed with ${uploadResponse.status}.`);
  }

  const url = asset.hostedUrl || asset.assetUrl;
  if (!url) throw new Error('Webflow did not return a hosted asset URL.');

  const collectionId = requireWebflowEnv('WEBFLOW_BOOKING_COLLECTION_ID');
  await webflowJson(`${WEBFLOW_API_BASE}/collections/${collectionId}/items/${item.id}/live?skipInvalidFiles=false`, {
    method: 'PATCH',
    body: JSON.stringify({
      fieldData: {
        [USER_IMAGE_FIELD]: { fileId: asset.id, url, alt: input.alt },
      },
    }),
  });

  return { fileId: asset.id, url };
}
