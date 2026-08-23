import { createHash } from 'node:crypto';
import type { BookingPageAssignedUser, BookingPageContent, CalendarTemplate } from '../types';

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2';
const TEMPLATE_IMAGE_FIELD = 'template-image';

interface WebflowImageValue {
  fileId?: string;
  url?: string;
  alt?: string;
}

export interface WebflowCollectionItem {
  id: string;
  cmsLocaleId?: string;
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

export class WebflowApiError extends Error {
  constructor(public readonly status: number) {
    super(`Webflow API request failed with ${status}.`);
    this.name = 'WebflowApiError';
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
    throw new WebflowApiError(response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function fieldString(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  return typeof value === 'string' ? value : '';
}

function fieldBoolean(fields: Record<string, unknown>, key: string) {
  return fields[key] === true;
}

function fieldReferences(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function meetingDurations(fields: Record<string, unknown>) {
  return [...new Set(
    fieldString(fields, 'meeting-durations')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 5 && value <= 480),
  )].sort((a, b) => a - b);
}

const THEME_OPTION_NAMES: Record<string, string> = {
  '56d54fcab5d4345689bd2ed4f91c86b2': 'default',
  de19b1a787631a7fa7465ac0ce660669: 'primary',
  '92b1e0fb7ba8cb271be2977f9680e91a': 'cyan',
  '65f7ca05d8d4bb4f63c4769d2207e4ce': 'powder',
  '54ead04968b81d364d6fc2c89eae383d': 'yellow',
  cdffc34f624175663ffab0393cd115d5: 'orange',
  '018ee43bb3cc33642df6a915a42dabfa': 'purple',
};

function fieldOption(fields: Record<string, unknown>, key: string) {
  const value = fieldString(fields, key);
  return THEME_OPTION_NAMES[value] || value;
}

function imageUrl(fields: Record<string, unknown>) {
  const image = fields[TEMPLATE_IMAGE_FIELD] as WebflowImageValue | undefined;
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

export async function listBookingPageItems(live = true) {
  const collectionId = requireWebflowEnv('WEBFLOW_BOOKING_COLLECTION_ID');
  const endpoint = live ? 'items/live' : 'items';
  let offset = 0;
  const items: WebflowCollectionItem[] = [];

  do {
    const result = await webflowJson<WebflowItemList>(
      `${WEBFLOW_API_BASE}/collections/${collectionId}/${endpoint}?limit=100&offset=${offset}`,
    );
    items.push(...result.items);

    const total = result.pagination?.total ?? result.items.length;
    offset += result.pagination?.limit ?? 100;
    if (offset >= total) return items;
  } while (true);
}

export async function findBookingPageItem(slug: string, live = true) {
  const items = await listBookingPageItems(live);
  return items.find((item) => item.fieldData.slug === slug) ?? null;
}

function assignedUser(item: WebflowCollectionItem): BookingPageAssignedUser {
  const fields = item.fieldData;
  return {
    id: item.id,
    slug: fieldString(fields, 'slug'),
    firstName: fieldString(fields, 'first-name'),
    lastName: fieldString(fields, 'last-name'),
    templateName: fieldString(fields, 'template-name'),
    googleCalendarId: fieldString(fields, 'google-calendar-id'),
  };
}

function normalizeBookingPageItem(
  item: WebflowCollectionItem,
  itemById: Map<string, WebflowCollectionItem>,
): CalendarTemplate {
  const fields = item.fieldData;
  const assignedUserIds = fieldReferences(fields, 'assigned-users');
  return {
    id: item.id,
    name: fieldString(fields, 'name'),
    slug: fieldString(fields, 'slug'),
    meetingTemplate: fieldString(fields, 'slug'),
    firstName: fieldString(fields, 'first-name'),
    lastName: fieldString(fields, 'last-name'),
    templateName: fieldString(fields, 'template-name'),
    eyebrow: fieldString(fields, 'meeting-template-eyebrow'),
    headline: fieldString(fields, 'meeting-template-headline'),
    subheadline: fieldString(fields, 'meeting-template-subheadline'),
    description: fieldString(fields, 'meeting-template-description'),
    isUserTemplate: fieldBoolean(fields, 'is-user-template'),
    userImageUrl: imageUrl(fields),
    googleCalendarId: fieldString(fields, 'google-calendar-id'),
    meetingDurations: meetingDurations(fields),
    assignedUserIds,
    assignedUsers: assignedUserIds
      .map((id) => itemById.get(id))
      .filter((assigned): assigned is WebflowCollectionItem => Boolean(assigned))
      .map(assignedUser),
    useTheme: fieldBoolean(fields, 'use-theme'),
    themeOption: fieldOption(fields, 'theme-option'),
    themeBackground: fieldString(fields, 'theme-color'),
    themeForeground: fieldString(fields, 'theme-foreground'),
  };
}

export async function listBookingPages(live = true): Promise<CalendarTemplate[]> {
  const items = await listBookingPageItems(live);
  const itemById = new Map(items.map((item) => [item.id, item]));
  return items.map((item) => normalizeBookingPageItem(item, itemById));
}

export async function bookingPageContent(slug: string): Promise<BookingPageContent | null> {
  const pages = await listBookingPages(true);
  const page = pages.find((candidate) => candidate.slug === slug);
  if (!page) return null;
  const { id: _id, googleCalendarId: _calendarId, assignedUserIds: _assignedIds, assignedUsers: _assigned, ...publicPage } = page;
  return publicPage;
}

export interface CalendarTemplateInput {
  id?: string;
  name: string;
  slug: string;
  templateName: string;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  description?: string;
  isUserTemplate: boolean;
  firstName?: string;
  lastName?: string;
  googleCalendarId?: string;
  meetingDurations: number[];
  assignedUserIds: string[];
  useTheme?: boolean;
  themeOption?: string;
  themeBackground?: string;
  themeForeground?: string;
}

function calendarTemplateFields(input: CalendarTemplateInput) {
  return {
    name: input.name,
    slug: slugify(input.slug || input.name),
    'template-name': input.templateName,
    'meeting-template-eyebrow': input.eyebrow || '',
    'meeting-template-headline': input.headline || '',
    'meeting-template-subheadline': input.subheadline || '',
    'meeting-template-description': input.description || '',
    'is-user-template': input.isUserTemplate,
    'first-name': input.firstName || '',
    'last-name': input.lastName || '',
    'google-calendar-id': input.googleCalendarId || '',
    'meeting-durations': [...new Set(input.meetingDurations)].sort((a, b) => a - b).join(','),
    'assigned-users': input.isUserTemplate ? [] : input.assignedUserIds,
    'use-theme': input.useTheme === true,
    'theme-option': input.themeOption || null,
    'theme-color': input.themeBackground || '',
    'theme-foreground': input.themeForeground || '',
  };
}

export async function saveCalendarTemplate(input: CalendarTemplateInput) {
  const collectionId = requireWebflowEnv('WEBFLOW_BOOKING_COLLECTION_ID');
  const path = input.id ? `items/${input.id}` : 'items';
  const item = await webflowJson<WebflowCollectionItem>(`${WEBFLOW_API_BASE}/collections/${collectionId}/${path}`, {
    method: input.id ? 'PATCH' : 'POST',
    body: JSON.stringify({ fieldData: calendarTemplateFields(input), isArchived: false, isDraft: false }),
  });
  await publishCalendarTemplate(item.id);
  return item;
}

export async function ensureProviderBookingPage(profile: { email?: string; name?: string }) {
  const email = profile.email?.trim().toLowerCase();
  if (!email?.endsWith('@revrebel.io')) return null;

  const pages = await listBookingPages(false);
  const existingByEmail = pages.find((page) => page.isUserTemplate && page.googleCalendarId.toLowerCase() === email);
  if (existingByEmail) return existingByEmail;

  const nameParts = profile.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstName = nameParts.shift() || email.split('@')[0];
  const lastName = nameParts.join(' ');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const slug = providerSlug(fullName, email);
  const existingBySlug = pages.find((page) => page.slug === slug);
  if (existingBySlug) return existingBySlug;

  await saveCalendarTemplate({
    name: fullName,
    slug,
    templateName: `Book a Meeting with ${firstName}`,
    eyebrow: 'Select a Meeting Option',
    headline: `Book a Meeting with ${firstName}`,
    subheadline: '',
    description: '',
    isUserTemplate: true,
    firstName,
    lastName,
    googleCalendarId: email,
    meetingDurations: [15, 30, 60, 90],
    assignedUserIds: [],
    useTheme: true,
    themeOption: '56d54fcab5d4345689bd2ed4f91c86b2',
    themeBackground: '#EFF5F6',
    themeForeground: '#163666',
  });
  return (await listBookingPages(false)).find((page) => page.slug === slug) ?? null;
}

async function publishCalendarTemplate(id: string) {
  const collectionId = requireWebflowEnv('WEBFLOW_BOOKING_COLLECTION_ID');
  await webflowJson(`${WEBFLOW_API_BASE}/collections/${collectionId}/items/publish`, {
    method: 'POST',
    body: JSON.stringify({ itemIds: [id] }),
  });
}

export async function deleteCalendarTemplate(id: string) {
  const collectionId = requireWebflowEnv('WEBFLOW_BOOKING_COLLECTION_ID');
  await webflowJson(`${WEBFLOW_API_BASE}/collections/${collectionId}/items/${id}/live`, {
    method: 'DELETE',
  });
  await webflowJson(`${WEBFLOW_API_BASE}/collections/${collectionId}/items/${id}`, {
    method: 'DELETE',
  });
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
  await webflowJson(`${WEBFLOW_API_BASE}/collections/${collectionId}/items/${item.id}?skipInvalidFiles=false`, {
    method: 'PATCH',
    body: JSON.stringify({
      fieldData: {
        [TEMPLATE_IMAGE_FIELD]: { fileId: asset.id, url, alt: input.alt },
      },
    }),
  });
  await publishCalendarTemplate(item.id);

  return { fileId: asset.id, url };
}
