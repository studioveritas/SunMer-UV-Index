# UV Europe — backbone (v0.1)

A Next.js 16 web app that reports today's UV index for 20 European cities,
cross-checked across national meteorological services. This is the
engine and a deliberately neutral "greybox" UI; the creative layer drops
in on top of the tokens in `src/app/globals.css`.

## How it works

```
 Met Office (UK) ─┐   cloud-adjusted, hourly
 KNMI/TEMIS (NL) ─┤   clear-sky, solar noon          ┌─ /api/uv          all cities
 MET Norway ──────┼─► adapters ─► consensus engine ──┼─ /api/uv/:city    full detail
 Copernicus CAMS ─┤   (cached     (median per kind,  ├─ /api/sources     provenance
 DWD (DE) ────────┤    per source) agreement score)  ├─ /api/health      live probe
 Météo-France ────┘   (scaffolded)                    └─ /  and /city/:slug (UI)
```

**Core rule:** clear-sky UV (what the sun *could* do) and cloud-adjusted UV
(what's *expected*) are different measurements. They are never averaged.
The headline is the median of cloud-adjusted sources; clear-sky is shown
alongside, and the gap between them is reported as "cloud takes off".

**Confidence:** high = 3+ sources and the headline group agrees within
1.5 UVI; medium = 2+ within 3; low otherwise.

**Resilience:** adapters never throw. Each source reports `ok`, `error`,
`not_configured` or `not_covered`, and the page renders with whatever
is available.

## Sources

| Source | Measures | Key | Refresh | Notes |
|---|---|---|---|---|
| Met Office Weather DataHub (Global Spot) | Cloud-adjusted, hourly | Yes (free tier 360 calls/day) | 180 min | Covers every city |
| KNMI / TEMIS | Clear-sky at solar noon, 6 days | No | 6 h | Updated ~05:00 UTC daily |
| MET Norway Locationforecast | Clear-sky, hourly | No, but User-Agent with contact required | 60 min | |
| Copernicus CAMS via Open-Meteo | Cloud-adjusted, hourly | Only for commercial use | 60 min | Attribution to CAMS + Open-Meteo required |
| DWD UV-Gefahrenindex | Cloud-adjusted daily max | No | 3 h | Station-based; matched by German name |
| Météo-France UV API | Cloud-adjusted daily max | Yes | 3 h | **Off until endpoint is confirmed** — see `meteoFrance.ts` |

## Run locally

```bash
cp .env.example .env      # add MET_OFFICE_API_KEY and METNO_USER_AGENT
npm install
npm run check-sources     # live test of every source for Amsterdam
npm test                  # parser + consensus unit tests
npm run dev               # http://localhost:3000
```

## Deploy on a bespoke domain

**Vercel (fastest).** Import the repo, add the env vars from `.env.example`,
deploy. Functions are pinned to Frankfurt (`vercel.json`) to stay in the EU.
Then Project → Settings → Domains → add `yourdomain.eu` and set the DNS
records Vercel shows you at your registrar.

**Self-host / EU-only hosting.** `next.config.ts` builds with
`output: "standalone"`, so `npm run build` produces a Node server you can
put in a container on any EU provider. Put a CDN in front; the pages are
ISR-cached for 15 minutes.

## Extending

- **Add a city:** one line in `src/lib/config/cities.ts`. Watch the Met
  Office quota: cities × (1440 / refresh minutes) must stay under 360/day.
- **Add a source:** implement `Provider` (`src/lib/providers/base.ts`),
  register it in `providers/index.ts`, add a parser test.
- **Creative:** all visual decisions are CSS custom properties in
  `globals.css`. Keep the WHO colour tokens semantic.
