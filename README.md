# Aviation Aligned Website

Public marketing website for Aviation Aligned.

This repository is intentionally separate from the authenticated customer portal. The public website links to the portal at `https://portal.aviationaligned.com.au` but contains no Supabase credentials, customer data, authentication logic or portal source code.

## Local development

```bash
pnpm install
pnpm dev
```

## Production

Netlify builds the site with `pnpm build` and publishes `dist`.
