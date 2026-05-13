import { NextRequest, NextResponse } from 'next/server';

const { getJson } = require('@/lib/cache');
const { normalizeUsername } = require('@/lib/instagramPrivateApi');

// Check if the profile is cached (private) to get avatar URL
async function getAvatarUrlFromCache(username: string): Promise<string | null> {
  const profileKey = `ig:profile:${username.toLowerCase()}`;
  const cached = await getJson(profileKey);
  if (!cached) return null;

  const data = cached?.data || cached;
  const url = data?.profilePicUrl || data?.profilePicUrlHD;
  return typeof url === 'string' && url ? url : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = normalizeUsername(searchParams.get('username') || '');

  if (!username) {
    return NextResponse.json({ error: 'missing_username' }, { status: 400 });
  }

  // Try to get avatar URL from cache
  let avatarUrl = await getAvatarUrlFromCache(username).catch(() => null);

  // If not in cache, try fetching via public profile endpoint
  if (!avatarUrl) {
    try {
      const publicRes = await fetch(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            'User-Agent': 'Instagram 76.0.0.15.395 Android',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (publicRes.ok) {
        const data = await publicRes.json().catch(() => null);
        const user = data?.data?.user;
        avatarUrl =
          user?.profile_pic_url_hd || user?.profile_pic_url || null;
      }
    } catch {
      // fallback to nothing
    }
  }

  if (!avatarUrl || !/^https:\/\//i.test(avatarUrl)) {
    return NextResponse.json({ error: 'avatar_not_found' }, { status: 404 });
  }

  // Proxy the image
  try {
    const imgRes = await fetch(avatarUrl, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!imgRes.ok) {
      return NextResponse.json({ error: 'avatar_fetch_failed' }, { status: imgRes.status });
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=1800',
        'X-Sammvsc-Api': 'instagram-avatar',
      },
    });
  } catch {
    return NextResponse.json({ error: 'avatar_proxy_failed' }, { status: 502 });
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
