# Deployment

This project needs a backend-capable host for `/api/instagram` and `/api/instagram/profile`.
GitHub Pages can serve the static pages, but it cannot run the API endpoint.

## Recommended host

Use Vercel and connect this GitHub repository.

## Environment variables

Choose one provider and add the matching variables in Vercel Project Settings > Environment Variables.
The frontend calls `/api/instagram/profile` first, then falls back to `/api/instagram`.
Provider keys stay private on the backend.

## Discord profile statistics

Discord identity/profile data comes from the existing Discord, DCSV, and Findcord fallback flow.
Server activity statistics can be enriched with Statbot when a guild has Statbot API access.

Statbot keys are guild scoped. Add either a JSON map:

```env
STATBOT_GUILD_KEYS={"123456789012345678":"statbot_api_key_for_that_guild"}
```

or comma/newline separated pairs:

```env
STATBOT_GUILD_KEYS=123456789012345678=statbot_api_key,987654321098765432=another_key
```

Optional Statbot settings:

```env
STATBOT_API_BASE=https://api.statbot.net
STATBOT_CACHE_TTL=600
STATBOT_MAX_GUILDS=8
```

Statbot results are cached per guild and user. If Statbot is not configured or a guild does not have a key,
the profile still renders with Discord/DCSV/Findcord data and soft placeholders instead of hard failures.

## Fast profile API

The fast path uses `instagram-private-api` from a Vercel Serverless Function.
It reads Redis/Vercel KV before calling Instagram:

```text
ig:profile:{username}
ig:profile:stale:{username}
ig:session:{login_username}
ig:lock:{username}
```

Required production variables:

```env
IG_PRIVATE_USERNAME=your_instagram_login_username
IG_PRIVATE_PASSWORD=your_instagram_login_password
KV_REST_API_URL=your_vercel_kv_or_upstash_rest_url
KV_REST_API_TOKEN=your_vercel_kv_or_upstash_rest_token
```

Recommended optional variables:

```env
INSTAGRAM_PROFILE_TTL_SECONDS=21600
INSTAGRAM_PROFILE_STALE_TTL_SECONDS=604800
IG_SESSION_TTL_SECONDS=1209600
IG_REQUEST_MIN_DELAY_MS=1200
IG_REQUEST_RANDOM_DELAY_MS=1800
IG_LOGIN_COOLDOWN_SECONDS=600
IG_PROXY=
```

Use a dedicated Instagram account for `IG_PRIVATE_USERNAME`. Do not use a personal main account.
Vercel serverless instances are temporary, so Redis/KV is required in production for session and cache persistence.

RapidAPI is the easiest cheap trial:

```env
INSTAGRAM_PROVIDER=rapidapi
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=instagram-scraper-api2.p.rapidapi.com
RAPIDAPI_URL_TEMPLATE=https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url={username}
```

If your RapidAPI endpoint uses POST/form data, also add:

```env
RAPIDAPI_METHOD=POST
RAPIDAPI_BODY_TEMPLATE=username_or_url=https://www.instagram.com/{username}/
```

Apify is usually more stable for scraping jobs:

```env
INSTAGRAM_PROVIDER=apify
APIFY_TOKEN=your_apify_token
APIFY_ACTOR=apify/instagram-profile-scraper
```

Keep Apify configured as the fallback provider. If the private API fails and no stale cache exists, `/api/instagram/profile` can still use Apify.

Bright Data:

```env
INSTAGRAM_PROVIDER=brightdata
BRIGHTDATA_API_KEY=your_brightdata_api_key
BRIGHTDATA_DATASET_ID=gd_l1vikfch901nx3by4
```

ScrapingBee:

```env
INSTAGRAM_PROVIDER=scrapingbee
SCRAPINGBEE_API_KEY=your_scrapingbee_api_key
```

Optional official Meta token for only your connected Instagram account:

```env
IG_ACCESS_TOKEN=your_meta_generated_token
META_GRAPH_VERSION=v20.0
```

Never commit provider keys or tokens to the repository.

## Local test

Install dependencies, then run Vercel locally:

```bash
npm install
npm i -g vercel
vercel dev
```

Create a local `.env` file or add the same variables through Vercel. Then test:

```text
http://localhost:3000/api/instagram?username=instagram
http://localhost:3000/api/instagram/profile?username=instagram
http://localhost:3000/api/debug/instagram?username=instagram
http://localhost:3000/profile.html?u=instagram
```

Run a syntax check:

```bash
npm run check
```

## Vercel settings

Use these project settings:

```text
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: empty
Node.js Version: 20.x or newer
```

After changing environment variables, redeploy the latest production deployment.

## Production debug

Open this URL after deployment:

```text
https://www.sammvsc.top/api/debug/instagram?username=instagram
```

It does not return passwords, tokens, cookies, or serialized session data. It only reports:

```text
loginStatus
session.restoreSuccess
cache.readSuccess/writeSuccess
tookMs
instagramFetch.success or fail reason
```

## Domain

After deployment, add `sammvsc.top` in Vercel Project Settings > Domains and update DNS as Vercel instructs.
