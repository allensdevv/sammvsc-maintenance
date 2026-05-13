import { NextRequest, NextResponse } from 'next/server';

// Use require() for CommonJS modules
const { fetchPrivateProfile, normalizeUsername } = require('@/lib/instagramPrivateApi');
const { acquireLock, getJson, releaseLock, setJson, sleep } = require('@/lib/cache');

const PROFILE_TTL_SECONDS = Number(process.env.INSTAGRAM_PROFILE_TTL_SECONDS || 60 * 60 * 6);
const STALE_PROFILE_TTL_SECONDS = Number(process.env.INSTAGRAM_PROFILE_STALE_TTL_SECONDS || 60 * 60 * 24 * 7);
const LOCK_TTL_SECONDS = Number(process.env.INSTAGRAM_PROFILE_LOCK_TTL_SECONDS || 45);
const USER_MESSAGE = 'Profil bilgileri şu an alınamıyor. Lütfen sonra tekrar deneyin.';

function profileKey(username: string) {
  return `ig:profile:${username.toLowerCase()}`;
}

function staleProfileKey(username: string) {
  return `ig:profile:stale:${username.toLowerCase()}`;
}

function lockKey(username: string) {
  return `ig:lock:${username.toLowerCase()}`;
}

function tookMs(startedAt: number) {
  return Date.now() - startedAt;
}

function makeRecord(data: unknown, cachedAt = new Date().toISOString()) {
  return { cachedAt, data };
}

function unwrapRecord(record: unknown) {
  if (!record) return null;
  const r = record as Record<string, unknown>;
  if (r.data) return r;
  return makeRecord(record, undefined);
}

function ready(source: string, record: unknown, startedAt: number) {
  const normalized = unwrapRecord(record);
  return {
    status: 'ready',
    source,
    tookMs: tookMs(startedAt),
    cachedAt: (normalized as Record<string, unknown> | null)?.cachedAt || null,
    data: (normalized as Record<string, unknown> | null)?.data || null,
  };
}

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = key.split('.').reduce<unknown>((obj, part) => {
      if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[part];
      return undefined;
    }, source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
}

function normalizeApifyProfile(raw: unknown, requestedUsername: string) {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const username = (pick(r, ['username', 'user.username']) as string) || requestedUsername;
  return {
    username,
    fullName: (pick(r, ['fullName', 'full_name', 'name', 'user.full_name']) as string) || username,
    biography: (pick(r, ['biography', 'bio', 'user.biography']) as string) || '',
    profilePicUrl:
      (pick(r, [
        'profilePicUrlHD',
        'profilePicUrl',
        'profile_pic_url_hd',
        'profile_pic_url',
        'profile_picture_url',
        'user.profile_pic_url',
      ]) as string) || '',
    followers: toNumber(pick(r, ['followersCount', 'followers', 'follower_count', 'followers_count'])),
    following: toNumber(pick(r, ['followsCount', 'following', 'following_count', 'follows_count'])),
    posts: toNumber(pick(r, ['postsCount', 'mediaCount', 'media_count', 'posts'])),
    isPrivate: toBoolean(pick(r, ['private', 'isPrivate', 'is_private'])),
    isVerified: toBoolean(pick(r, ['verified', 'isVerified', 'is_verified'])),
  };
}

async function fetchApifyFallbackProfile(username: string) {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR || 'apify/instagram-profile-scraper';

  if (!token) {
    const error = Object.assign(new Error('missing_APIFY_TOKEN'), { code: 'missing_apify_token' });
    throw error;
  }

  const actorId = actor.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usernames: [username], resultsLimit: 1 }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = Object.assign(new Error('apify_fallback_failed'), {
      code: 'apify_fallback_failed',
      status: response.status,
      payload,
    });
    throw error;
  }

  const first = Array.isArray(payload) ? payload[0] : payload;
  const profile = normalizeApifyProfile(first, username);
  if (!profile) {
    throw Object.assign(new Error('apify_parse_failed'), { code: 'apify_parse_failed' });
  }

  return profile;
}

async function writeProfileCache(username: string, data: unknown) {
  const record = makeRecord(data);
  await Promise.all([
    setJson(profileKey(username), record, PROFILE_TTL_SECONDS),
    setJson(staleProfileKey(username), record, STALE_PROFILE_TTL_SECONDS),
  ]);
  return record;
}

function errorStatus(error: unknown): number {
  const e = error as { code?: string } | null;
  if (e?.code === 'missing_credentials') return 500;
  if (e?.code === 'login_cooldown' || e?.code === 'login_in_progress') return 429;
  if (e?.code === 'missing_username') return 400;
  return 502;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const username = normalizeUsername(searchParams.get('username') || '');

  if (!username) {
    return NextResponse.json(
      { status: 'error', error: 'missing_username', message: 'Kullanıcı adı gerekli.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const key = profileKey(username);
  const cached = unwrapRecord(await getJson(key));
  if (cached) {
    return NextResponse.json(ready('cache', cached, startedAt), {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Sammvsc-Api': 'instagram-private-profile' },
    });
  }

  const locked = await acquireLock(lockKey(username), LOCK_TTL_SECONDS);
  if (!locked) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(900);
      const refreshed = unwrapRecord(await getJson(key));
      if (refreshed) {
        return NextResponse.json(ready('cache', refreshed, startedAt), {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }
    return NextResponse.json(
      { status: 'loading', source: 'live', tookMs: tookMs(startedAt), cachedAt: null, message: 'Profil bilgileri hazırlanıyor.' },
      { status: 202, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const profile = await fetchPrivateProfile(username);
    const record = await writeProfileCache(username, profile);
    return NextResponse.json(ready('live', record, startedAt), {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Sammvsc-Api': 'instagram-private-profile' },
    });
  } catch (error) {
    const e = error as { code?: string; name?: string; message?: string } | null;
    console.log('[instagram-private-profile] failed', { code: e?.code, name: e?.name, message: e?.message });

    const stale = unwrapRecord(await getJson(staleProfileKey(username)));
    if (stale) {
      return NextResponse.json(ready('stale', stale, startedAt), {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    try {
      const apifyProfile = await fetchApifyFallbackProfile(username);
      const record = await writeProfileCache(username, apifyProfile);
      return NextResponse.json(ready('apify', record, startedAt), {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (apifyError) {
      const ae = apifyError as { code?: string; status?: number; message?: string } | null;
      console.log('[instagram-private-profile] apify_fallback_failed', {
        code: ae?.code,
        status: ae?.status,
        message: ae?.message,
      });
    }

    return NextResponse.json(
      {
        status: 'error',
        source: 'live',
        tookMs: tookMs(startedAt),
        cachedAt: null,
        error: e?.code || 'instagram_private_api_failed',
        message: USER_MESSAGE,
      },
      { status: errorStatus(error), headers: { 'Cache-Control': 'no-store' } }
    );
  } finally {
    await releaseLock(lockKey(username));
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
}
