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

The default homepage includes the accepted native EC135-class helicopter,
mountain backdrop, held regional-jet approach and outlined SVG logo handoff.
Exhaust airflow is optional and removable. Reduced-motion composition is
provided; `aircraft=h145` retains the older optional scene.

The v7 pacing update uses two phone-screen lengths of scroll travel and 25%
less desktop travel, without intercepting touch or wheel scrolling. A tiny
current-model WebP first frame covers the live 3D loading time. See
`docs/hero-pacing-v7.md`; run `node scripts/verify-hero-startup.mjs` for the
startup and visible-rotor preservation checks. The accepted native mesh remains v6.

## Aircraft licence and matching source

The aircraft mesh derives from Heiko Schulz's GPL-2.0 EC135 source. Original
notices and the complete corresponding mesh/refinement source are included
in `public/campaign/light-twin/aircraft-refinement-source-v6.zip`; the live
footer links to that archive. See `public/campaign/light-twin/ATTRIBUTION.md`
and `docs/aircraft-refinement-v6.md`. The mesh licence does not relicense
Aviation Aligned's brand or the rest of this website, or imply Airbus endorsement.

Native geometry/rotor-preservation and sequence checks can be reproduced with
`node scripts/build-production-aircraft.mjs` and
`node scripts/verify-final-flight.mjs` using the supplied dependency lockfile.
