/**
 * Sun position and sun times (NOAA-style sunrise equation, ~1 min accuracy
 * at European latitudes). No API needed.
 */
const rad = Math.PI / 180;
const J2000 = 2451545.0;
const toJulian = (ms: number) => ms / 86_400_000 + 2440587.5;
const fromJulian = (j: number) => new Date((j - 2440587.5) * 86_400_000);

function solar(jd: number, lon: number) {
  const n = Math.round(jd - J2000 - 0.0008 - lon / 360) ; // cycle nearest the given day
  const jStar = n + 0.0008 - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = J2000 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  return { transit, decl };
}

/** Sun altitude in degrees at an instant. */
export function sunAltitude(at: Date, lat: number, lon: number): number {
  const jd = toJulian(at.getTime());
  const { transit, decl } = solar(jd, lon);
  const H = (jd - transit) * 360 * rad;
  return Math.asin(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(H)) / rad;
}

export interface SunTimes {
  dawn: Date | null;    // civil dawn, sun at -6°
  sunrise: Date | null; // -0.833° (refraction + solar disc)
  noon: Date;
  sunset: Date | null;
  dusk: Date | null;    // civil dusk
}

/** Sun times for the day containing `day` (pass local noon for safety). */
export function sunTimes(day: Date, lat: number, lon: number): SunTimes {
  const { transit, decl } = solar(toJulian(day.getTime()), lon);
  const at = (alt: number) => {
    const cosW = (Math.sin(alt * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
    if (cosW < -1 || cosW > 1) return null; // polar day or night
    const w = Math.acos(cosW) / rad;
    return [fromJulian(transit - w / 360), fromJulian(transit + w / 360)] as const;
  };
  const civil = at(-6);
  const rise = at(-0.833);
  return { dawn: civil?.[0] ?? null, sunrise: rise?.[0] ?? null, noon: fromJulian(transit), sunset: rise?.[1] ?? null, dusk: civil?.[1] ?? null };
}

export type SkyPhase = "day" | "dusk" | "night";

/** day: sun above 6°. dusk: golden hour + civil twilight (−6° to 6°). night: below −6°. */
export function skyPhase(at: Date, lat: number, lon: number): SkyPhase {
  const forced = process.env.UV_PHASE as SkyPhase | undefined;
  if (forced && ["day", "dusk", "night"].includes(forced)) return forced;
  const alt = sunAltitude(at, lat, lon);
  return alt > 6 ? "day" : alt > -6 ? "dusk" : "night";
}
