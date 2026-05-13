# Deployment

This project needs a backend-capable host for `/api/instagram/search`.
GitHub Pages can serve the static pages, but it cannot run the API endpoint.

## Recommended host

Use Vercel and connect this GitHub repository.

## Environment variables

Add these in Vercel Project Settings > Environment Variables:

```env
IG_USER_ID=17841475227315050
IG_ACCESS_TOKEN=your_meta_generated_token
META_GRAPH_VERSION=v20.0
```

Never commit `IG_ACCESS_TOKEN` to the repository.

Optional, only if public Instagram web profile lookup gets blocked by login/rate limits:

```env
IG_SESSION_ID=your_instagram_sessionid_cookie
```

Use `IG_SESSION_ID` carefully. It is sensitive and should only be stored as a private hosting environment variable.

## Local test

Install the Vercel CLI and run:

```bash
npm i -g vercel
vercel dev
```

Create a local `.env` file or add the same variables through Vercel. Then test:

```text
http://localhost:3000/api/instagram?username=erenbenkankasa
http://localhost:3000/profile.html?u=erenbenkankasa
```

## Domain

After deployment, add `sammvsc.top` in Vercel Project Settings > Domains and update DNS as Vercel instructs.
