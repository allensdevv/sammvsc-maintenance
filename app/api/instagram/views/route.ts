import { NextRequest, NextResponse } from 'next/server';

const { getText, incr } = require('@/lib/cache');
const { normalizeUsername } = require('@/lib/instagramPrivateApi');

const VIEW_COUNTER_TTL_SECONDS = Number(process.env.INSTAGRAM_VIEW_COUNTER_TTL_SECONDS || 0);

function viewKey(username: string) {
  return `ig:views:${username.toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = normalizeUsername(searchParams.get('username') || '');

  if (!username) {
    return NextResponse.json(
      { status: 'error', error: 'missing_username', message: 'Kullanıcı adı gerekli.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const shouldTrack = searchParams.get('track') !== '0';
  const key = viewKey(username);
  const count = shouldTrack
    ? await incr(key, VIEW_COUNTER_TTL_SECONDS)
    : Number((await getText(key)) || 0);

  return NextResponse.json(
    { status: 'ready', username, count, tracked: shouldTrack },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Sammvsc-Api': 'instagram-profile-views',
      },
    }
  );
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
