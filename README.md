# UV Europe (v0.5)

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

## New in v0.5

**Vibrant colour follows UV.** The field runs blue at low UV, lemon and sky
blue at moderate, oranges at high, reds at very high, crimson and magenta
at extreme (`src/lib/vibrant.ts`). Bars, gauges, the run band and the
Instagram cards use the same scale.

**Day, dusk, night in both looks.** Phase comes from the sun's height over
each city: above 6° day; 6° to −6° dusk (golden hour and civil twilight),
when the vibrant field turns pink-violet; below −6° night, with near-black
paper, an indigo-violet field that keeps one blob in the day's UV colour,
stars, a crescent, and the headline switched to tomorrow. Pages are cached
for 15 minutes, so the phase can lag the real sky by up to that.
Force a phase for review with `UV_PHASE=day|dusk|night` (set at build time
for pages, at runtime for cards).

**Today / Week ahead.** Each city page has a tab switch (`#week` links
straight to the week). The week view shows a one-line read of the week,
highest, lowest, protect days, a bar per day coloured by its level, and a
day-by-day list with protection hours and sunset (`src/lib/week.ts`).
Days beyond any cloud forecast are drawn as outlines ("cloud-free
potential"); "Strongest" prefers days with a real cloud forecast. Protection
hours use the hourly forecast where one exists, otherwise a clear-sky curve
that follows the sun's height.

**Week ahead Instagram card.** `/api/card/:city?kind=week&format=story|post`
draws seven coloured bars on a field set by the week's strongest day, in
either look and any sky. Download it from the Week ahead tab or from
`/share`. Made for Monday posting.

**Colour morph between cities.** The vibrant field now lives in the root
layout and persists across navigation. Each page only declares its colours
on `:root`; the colours are registered CSS properties (`@property`), so the
browser animates from one city's colours to the next over 1.4 s. Turned
off for people who prefer reduced motion.

## v0.4: "Vibrant" design trial + Instagram downloads

**Two looks, same content.** `classic` (the sunset reference) and
`vibrant` (bright blurred colour fields on white, IBM Plex Mono throughout,
oversized numerals bleeding off the edge, hairline rows, black
circle-arrow actions). Vibrant is a stylesheet over the same markup
(`src/app/vibrant.css`), so nothing in the content differs between arms.

How a visitor gets a look, decided before first paint:
1. `?look=classic` or `?look=vibrant` in the URL;
2. the look this browser was already given (testers stay in one arm);
3. `NEXT_PUBLIC_LOOK` = `classic` | `vibrant` | `split` (default `split`:
   random 50/50, then kept).
The look is on `<html data-look>` and `window.uvLook` — pass it to your
analytics as a property to compare arms. A switch in the footer lets you flip.

The vibrant colours still carry the reading: violet/lemon when low,
gold/orange at moderate, orange/red when high, red/magenta very high,
magenta/violet extreme.

**Download today's UV for Instagram.** Every city page has "Post today's
UV" with live previews and two buttons: Instagram Story (1080×1920) and
Instagram Post (1080×1350, 4:5). On phones the share sheet opens (save to
Photos or post straight to Instagram); on desktop the PNG downloads.
`/share` lists every city with both downloads — public, no login, for the
admin and anyone else. Direct links work too:
`/api/card/:city?format=story|post&look=vibrant&download=1`.
Story cards keep text out of the top and bottom ~250px that Instagram
covers with its own controls.

## New in v0.3

**Night mode.** The page follows the sun, not the system theme. Sun
position is computed locally (`src/lib/sun.ts`, NOAA sunrise equation, ~1
min accuracy). Above 6°: day. From 6° to −6° (golden hour and civil
twilight): dusk sky. Below −6°: night, with an indigo palette, stars, a
crescent glyph, and the headline switches to tomorrow's peak and
tomorrow's best hours. Preview any phase with `UV_PHASE=day|dusk|night`.

**Share cards.** `/api/card/:city?format=story|square|og` renders today's
sky as a PNG (1080×1920, 1080×1080, 1200×630) with self-hosted fonts.
"Share today's sky" opens the native share sheet on phones (Web Share API
with files) and downloads elsewhere. City pages use the `og` card as their
link preview, so every shared link shows that day's sky.

**Your dose today.** Log time outside with a live timer or quick adds.
Dose is integrated minute by minute over each session (KNMI measurements
where available, forecast elsewhere) and shown as % of your burn dose and
in SED (standard erythema doses, 100 J/m²). Uses the skin type and
sunscreen set in the burn panel. Stored in the browser only, per day.

**Best hours for a run.** Sunrise to sunset as one band: UV below 3
(no protection needed for most people), 3–5, and 6+. The headline is the
longest low-UV window still ahead today. Classified on the rounded UV, as
the WHO reports it.

**Ground truth** (`/ground-truth`). KNMI satellite UV against RIVM's
ground spectroradiometer at Bilthoven, the only ground UV station in the
Netherlands: today's chart, typical gap, bias, correlation. Plus a
forecast scoreboard: the morning cron records every service's forecast
for Bilthoven, and each is scored against the peak RIVM measured.
Data: `/api/validation` (JSON) and `?format=csv`.

For the publishable story, `npm run backfill-validation -- 2026-04-01 2026-09-30`
builds `data/validation/pairs.csv` and `summary.json` (overall, by month,
by UV level). It assumes KNMI file names contain YYYYMMDD; check the first
listing it prints.

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
