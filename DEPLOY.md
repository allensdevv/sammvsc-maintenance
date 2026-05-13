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

## Domain

After deployment, add `sammvsc.top` in Vercel Project Settings > Domains and update DNS as Vercel instructs.
