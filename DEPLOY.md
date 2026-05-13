# Deployment

This project needs a backend-capable host for `/api/instagram`.
GitHub Pages can serve the static pages, but it cannot run the API endpoint.

## Recommended host

Use Vercel and connect this GitHub repository.

## Environment variables

Choose one provider and add the matching variables in Vercel Project Settings > Environment Variables.
The frontend only calls `/api/instagram`; provider keys stay private on the backend.

RapidAPI is the easiest cheap trial:

```env
INSTAGRAM_PROVIDER=rapidapi
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=instagram-scraper-api2.p.rapidapi.com
RAPIDAPI_URL_TEMPLATE=https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url={username}
```

Apify is usually more stable for scraping jobs:

```env
INSTAGRAM_PROVIDER=apify
APIFY_TOKEN=your_apify_token
APIFY_ACTOR=apify/instagram-profile-scraper
```

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

Install the Vercel CLI and run:

```bash
npm i -g vercel
vercel dev
```

Create a local `.env` file or add the same variables through Vercel. Then test:

```text
http://localhost:3000/api/instagram?username=instagram
http://localhost:3000/profile.html?u=instagram
```

## Domain

After deployment, add `sammvsc.top` in Vercel Project Settings > Domains and update DNS as Vercel instructs.
