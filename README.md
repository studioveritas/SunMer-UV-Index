# UV Europe (v0.2)

A Next.js 16 web app that reports today's UV index for 20 European cities,
cross-checked across national meteorological services.

v0.2 adds the visual system (after the "Today's sunset" reference), a
measured KNMI Benelux layer, burn time by skin type, push alerts, and a
six-day outlook.

## Visual system

- The hero sky is the reading: the orb's size and colour are interpolated
  from the UV index (`src/lib/palette.ts`).
- The half-sun glyph gains rays with UV (8 at 0, 32 at 12+).
- The three dots top-left are the three core services; filled = reporting.
- Jost for figures, Roboto Mono caps for labels, self-hosted via
  @fontsource (no calls to Google's servers, see GDPR note below).
- WHO colours survive only as the small category marker, so the brand
  palette can stay soft without breaking the public-health standard.

Design without API keys: `UV_DEMO=1 npm run dev` serves synthetic data and
labels it as demo in the footer.

## New in v0.2

**KNMI Benelux layer (measured).** Satellite-derived UV every 15 minutes
for Amsterdam, Rotterdam, Brussels and Luxembourg, from the KNMI Data
Platform dataset `cloud_modified_UV_index_benelux` (NetCDF4, variables
`uvi_clear`/`uvi_cloudy`). Read with h5wasm, cached as a small extract
every 15 min. It powers "Right now" when fresher than the forecast, and
the "Measured today" curve. Needs `KNMI_API_KEY`.

**Burn time by skin type.** Integrates the hourly cloud-adjusted forecast
minute by minute until 1 MED (Fitzpatrick I–VI: 200–1000 J/m²). Shows
"if out now" and "at peak". The sunscreen toggle contrasts the label SPF
with real-life application (≈1 mg/cm² vs the tested 2 mg/cm²; effective
SPF ≈ SPF^0.5). Skin type is stored only in the browser.

**Push alerts.** Web Push (VAPID) with a service worker and PWA manifest.
Per city and threshold (3, 6, 8, 11): a morning heads-up if today will
reach it, and an alert when it does. At most two a day. Subscriptions
live in Upstash Redis; nothing else is stored. On iPhone, alerts require
the site on the Home Screen (iOS 16.4+); the UI explains this.

Scheduling: `vercel.json` runs `/api/cron/alerts` once a day at 05:00
UTC, which is all the Vercel Hobby plan allows. On Pro, change it to
`0 5-15 * * *` for hourly "it's crossing now" alerts, or call the endpoint
from any external scheduler with `Authorization: Bearer $CRON_SECRET`.

**Six-day outlook.** One consensus per day. Cloud-adjusted where any
service forecasts that far (Met Office 2 days, DWD 3, CAMS 5); beyond that
it shows the cloud-free potential, drawn as a dashed circle so the drop in
certainty is visible. Days whose data stops before midday are dropped.

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

## GDPR notes

Fonts are self-hosted (a 2022 Munich ruling found that loading Google
Fonts from Google's servers breached GDPR). Push subscriptions are
browser endpoints, so treat them as personal data: they're deleted on
unsubscribe or when the push service reports them gone. Pick an EU
region for Redis.

## Run locally

```bash
cp .env.example .env      # add MET_OFFICE_API_KEY, METNO_USER_AGENT, KNMI_API_KEY
npx web-push generate-vapid-keys   # paste into .env for alerts
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
