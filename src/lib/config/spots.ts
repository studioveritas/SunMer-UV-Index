import type { City } from "../types";

/**
 * Sea & Snow: surf breaks, beaches and ski resorts.
 *
 * A Spot is a City with a sport, a surface and elevations, so every provider,
 * curve, card and burn calculation works on it unchanged.
 *
 * Coordinates: the break / beach, or the resort village for ski.
 * Elevations (metres): `base` = village, `slopes` = typical skiing altitude
 * (roughly mid-mountain, where most of the day is spent), `summit` = top lift.
 * `ref` = the altitude the forecast UV is taken to represent. Forecast grids
 * (CAMS ~0.4°, TEMIS 0.25°) smooth mountains away, so we assume the value
 * stands for the village and correct upwards from there. Stated as an
 * assumption on every ski page.
 *
 * Met Office is skipped for spots: its free quota (360 calls/day) is kept
 * for the 20 cities.
 */
export type SpotKind = "surf" | "beach" | "ski";

export interface Spot extends City {
  kind: SpotKind;
  region: string;
  /** Short line shown under the name. */
  blurb: string;
  base: number;
  slopes?: number;
  summit?: number;
  ref: number;
  /** Ski: glacier = snow and skiing in autumn and late spring. */
  glacier?: boolean;
  /** Months the spot is "in season" for its sport (1 = Jan). */
  season: number[];
}

const SEA_SKIP = { skip: ["met-office" as const] };
const ALL_YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SURF_UK = [9, 10, 11, 12, 1, 2, 3, 4]; // autumn/winter Atlantic swells
const SURF_FR = [9, 10, 11, 12, 1, 2, 3, 4, 5];
const BEACH = [5, 6, 7, 8, 9];
const WINTER = [12, 1, 2, 3, 4];
const LONG_WINTER = [11, 12, 1, 2, 3, 4, 5];
const GLACIER = [9, 10, 11, 12, 1, 2, 3, 4, 5];

const uk = (s: Omit<Spot, "country" | "tz" | "base" | "ref" | "skip">): Spot => ({ ...s, ...SEA_SKIP, country: "GB", tz: "Europe/London", base: 0, ref: 0 });
const frSea = (s: Omit<Spot, "country" | "tz" | "base" | "ref" | "skip">): Spot => ({ ...s, ...SEA_SKIP, country: "FR", tz: "Europe/Paris", base: 0, ref: 0 });
const ski = (country: "FR" | "AT" | "IT", s: Omit<Spot, "country" | "tz" | "kind" | "ref" | "skip">): Spot => ({
  ...s,
  ...SEA_SKIP,
  kind: "ski",
  country,
  tz: { FR: "Europe/Paris", AT: "Europe/Vienna", IT: "Europe/Rome" }[country],
  ref: s.base,
});

export const SEA_SPOTS: Spot[] = [
  // United Kingdom
  uk({ slug: "fistral", name: "Fistral", region: "Cornwall", kind: "surf", lat: 50.417, lon: -5.101, blurb: "Newquay. The UK's surf capital", season: SURF_UK }),
  uk({ slug: "watergate-bay", name: "Watergate Bay", region: "Cornwall", kind: "beach", lat: 50.444, lon: -5.043, blurb: "Two miles of open sand, kite and surf", season: ALL_YEAR }),
  uk({ slug: "porthleven", name: "Porthleven", region: "Cornwall", kind: "surf", lat: 50.083, lon: -5.317, blurb: "Reef break for experienced surfers", season: SURF_UK }),
  uk({ slug: "croyde", name: "Croyde", region: "Devon", kind: "surf", lat: 51.131, lon: -4.237, blurb: "North Devon's punchy beach break", season: SURF_UK }),
  uk({ slug: "woolacombe", name: "Woolacombe", region: "Devon", kind: "beach", lat: 51.172, lon: -4.21, blurb: "Long sandy beach, gentle surf", season: ALL_YEAR }),
  uk({ slug: "llangennith", name: "Llangennith", region: "Wales", kind: "surf", lat: 51.6, lon: -4.292, blurb: "Gower. Wales's most consistent beach", season: SURF_UK }),
  uk({ slug: "freshwater-west", name: "Freshwater West", region: "Wales", kind: "surf", lat: 51.656, lon: -5.064, blurb: "Pembrokeshire. Powerful and open to swell", season: SURF_UK }),
  uk({ slug: "saltburn", name: "Saltburn", region: "Northern England", kind: "surf", lat: 54.585, lon: -0.97, blurb: "North Sea surf under the pier", season: SURF_UK }),
  uk({ slug: "thurso-east", name: "Thurso East", region: "Scotland", kind: "surf", lat: 58.596, lon: -3.515, blurb: "Cold-water reef, world-class in winter", season: SURF_UK }),
  uk({ slug: "portrush", name: "Portrush", region: "Northern Ireland", kind: "surf", lat: 55.207, lon: -6.652, blurb: "East Strand on the Causeway Coast", season: SURF_UK }),
  uk({ slug: "bournemouth", name: "Bournemouth", region: "South Coast", kind: "beach", lat: 50.716, lon: -1.875, blurb: "Seven miles of sand, year-round swimmers", season: BEACH }),
  uk({ slug: "brighton", name: "Brighton", region: "South Coast", kind: "beach", lat: 50.819, lon: -0.137, blurb: "Shingle beach, sea swims all winter", season: BEACH }),
  // France
  frSea({ slug: "hossegor", name: "Hossegor", region: "Landes", kind: "surf", lat: 43.668, lon: -1.444, blurb: "La Gravière. Europe's heaviest beach break", season: SURF_FR }),
  frSea({ slug: "seignosse", name: "Seignosse", region: "Landes", kind: "surf", lat: 43.695, lon: -1.443, blurb: "Les Estagnots and Les Bourdaines", season: SURF_FR }),
  frSea({ slug: "capbreton", name: "Capbreton", region: "Landes", kind: "surf", lat: 43.642, lon: -1.446, blurb: "Jetty peaks on the Gouf canyon", season: SURF_FR }),
  frSea({ slug: "biarritz", name: "Biarritz", region: "Basque Coast", kind: "surf", lat: 43.48, lon: -1.566, blurb: "Côte des Basques, the birthplace of French surf", season: SURF_FR }),
  frSea({ slug: "anglet", name: "Anglet", region: "Basque Coast", kind: "surf", lat: 43.515, lon: -1.53, blurb: "Les Cavaliers and eleven beaches in a row", season: SURF_FR }),
  frSea({ slug: "guethary", name: "Guéthary", region: "Basque Coast", kind: "surf", lat: 43.426, lon: -1.611, blurb: "Parlementia, the big-wave reef", season: SURF_FR }),
  frSea({ slug: "lacanau", name: "Lacanau", region: "Gironde", kind: "surf", lat: 45.001, lon: -1.202, blurb: "Bordeaux's beach, sandbanks for miles", season: SURF_FR }),
  frSea({ slug: "la-torche", name: "La Torche", region: "Brittany", kind: "surf", lat: 47.839, lon: -4.35, blurb: "Finistère. Brittany's surf and windsurf point", season: SURF_FR }),
  frSea({ slug: "les-sables", name: "Les Sables-d'Olonne", region: "Vendée", kind: "beach", lat: 46.496, lon: -1.783, blurb: "Atlantic beach town, Vendée Globe home", season: BEACH }),
  frSea({ slug: "pampelonne", name: "Pampelonne", region: "Riviera", kind: "beach", lat: 43.229, lon: 6.662, blurb: "Saint-Tropez. Mediterranean light, long season", season: [4, 5, 6, 7, 8, 9, 10] }),
];

export const SNOW_SPOTS: Spot[] = [
  // France
  ski("FR", { slug: "chamonix", name: "Chamonix", region: "Haute-Savoie", lat: 45.924, lon: 6.869, base: 1035, slopes: 2200, summit: 3275, blurb: "Mont-Blanc. Grands Montets and the Vallée Blanche", season: WINTER }),
  ski("FR", { slug: "val-disere", name: "Val d'Isère", region: "Savoie", lat: 45.449, lon: 6.981, base: 1850, slopes: 2500, summit: 3456, blurb: "Espace Killy with Tignes", season: LONG_WINTER }),
  ski("FR", { slug: "tignes", name: "Tignes", region: "Savoie", lat: 45.468, lon: 6.906, base: 2100, slopes: 2700, summit: 3456, glacier: true, blurb: "Grande Motte glacier, skiing from autumn", season: GLACIER }),
  ski("FR", { slug: "val-thorens", name: "Val Thorens", region: "Savoie", lat: 45.298, lon: 6.58, base: 2300, slopes: 2700, summit: 3230, blurb: "Europe's highest resort village, 3 Vallées", season: LONG_WINTER }),
  ski("FR", { slug: "courchevel", name: "Courchevel", region: "Savoie", lat: 45.415, lon: 6.635, base: 1850, slopes: 2200, summit: 2738, blurb: "3 Vallées. Saulire and the Grand Couloir", season: WINTER }),
  ski("FR", { slug: "alpe-dhuez", name: "Alpe d'Huez", region: "Isère", lat: 45.091, lon: 6.065, base: 1860, slopes: 2400, summit: 3330, blurb: "South-facing 'island in the sun'", season: WINTER }),
  ski("FR", { slug: "les-deux-alpes", name: "Les Deux Alpes", region: "Isère", lat: 45.008, lon: 6.123, base: 1650, slopes: 2600, summit: 3568, glacier: true, blurb: "Glacier skiing to 3,568 m", season: GLACIER }),
  ski("FR", { slug: "les-arcs", name: "Les Arcs", region: "Savoie", lat: 45.572, lon: 6.83, base: 1600, slopes: 2300, summit: 3226, blurb: "Paradiski. Aiguille Rouge", season: WINTER }),
  // Austria
  ski("AT", { slug: "st-anton", name: "St Anton", region: "Tyrol", lat: 47.13, lon: 10.268, base: 1304, slopes: 2100, summit: 2811, blurb: "Arlberg. Valluga and deep off-piste", season: WINTER }),
  ski("AT", { slug: "ischgl", name: "Ischgl", region: "Tyrol", lat: 47.013, lon: 10.289, base: 1377, slopes: 2300, summit: 2872, blurb: "Silvretta Arena, high and snow-sure", season: LONG_WINTER }),
  ski("AT", { slug: "solden", name: "Sölden", region: "Tyrol", lat: 46.966, lon: 11.008, base: 1377, slopes: 2600, summit: 3340, glacier: true, blurb: "Two glaciers, World Cup opener in October", season: GLACIER }),
  ski("AT", { slug: "hintertux", name: "Hintertux", region: "Tyrol", lat: 47.063, lon: 11.689, base: 1500, slopes: 2700, summit: 3250, glacier: true, blurb: "Austria's year-round glacier", season: ALL_YEAR }),
  ski("AT", { slug: "kaprun", name: "Kaprun", region: "Salzburg", lat: 47.272, lon: 12.759, base: 768, slopes: 2500, summit: 3029, glacier: true, blurb: "Kitzsteinhorn glacier, open from autumn", season: GLACIER }),
  ski("AT", { slug: "obergurgl", name: "Obergurgl", region: "Tyrol", lat: 46.871, lon: 11.027, base: 1930, slopes: 2500, summit: 3080, blurb: "High Ötztal, long season", season: LONG_WINTER }),
  ski("AT", { slug: "kitzbuhel", name: "Kitzbühel", region: "Tyrol", lat: 47.446, lon: 12.393, base: 762, slopes: 1500, summit: 2000, blurb: "Hahnenkamm. Low, historic, sunny", season: WINTER }),
  ski("AT", { slug: "saalbach", name: "Saalbach", region: "Salzburg", lat: 47.391, lon: 12.636, base: 1003, slopes: 1600, summit: 2096, blurb: "Skicircus with Hinterglemm and Leogang", season: WINTER }),
  // Italy
  ski("IT", { slug: "cervinia", name: "Cervinia", region: "Aosta Valley", lat: 45.934, lon: 7.63, base: 2050, slopes: 2900, summit: 3480, glacier: true, blurb: "Under the Matterhorn, linked to Zermatt", season: GLACIER }),
  ski("IT", { slug: "courmayeur", name: "Courmayeur", region: "Aosta Valley", lat: 45.797, lon: 6.969, base: 1224, slopes: 2000, summit: 2755, blurb: "Italian side of Mont Blanc", season: WINTER }),
  ski("IT", { slug: "cortina", name: "Cortina d'Ampezzo", region: "Dolomites", lat: 46.541, lon: 12.136, base: 1224, slopes: 2000, summit: 2939, blurb: "Tofana. Olympic host 2026", season: WINTER }),
  ski("IT", { slug: "val-gardena", name: "Val Gardena", region: "Dolomites", lat: 46.555, lon: 11.761, base: 1563, slopes: 2100, summit: 2518, blurb: "Selva, Sella Ronda, Seceda", season: WINTER }),
  ski("IT", { slug: "alta-badia", name: "Alta Badia", region: "Dolomites", lat: 46.55, lon: 11.873, base: 1568, slopes: 2100, summit: 2778, blurb: "Corvara. Gran Risa and the Sella Ronda", season: WINTER }),
  ski("IT", { slug: "livigno", name: "Livigno", region: "Lombardy", lat: 46.538, lon: 10.136, base: 1816, slopes: 2300, summit: 2797, blurb: "High duty-free valley, Olympic 2026 venue", season: LONG_WINTER }),
  ski("IT", { slug: "madonna-di-campiglio", name: "Madonna di Campiglio", region: "Trentino", lat: 46.229, lon: 10.827, base: 1550, slopes: 2000, summit: 2504, blurb: "Brenta Dolomites", season: WINTER }),
  ski("IT", { slug: "sestriere", name: "Sestriere", region: "Piedmont", lat: 44.958, lon: 6.879, base: 2035, slopes: 2400, summit: 2823, blurb: "Via Lattea, Turin 2006 venue", season: WINTER }),
];

export const SPOTS: Spot[] = [...SEA_SPOTS, ...SNOW_SPOTS];

export function getSpot(slug: string): Spot | undefined {
  return SPOTS.find((s) => s.slug === slug);
}

export const SPORT_LABEL: Record<SpotKind, string> = { surf: "Surf", beach: "Beach", ski: "Ski" };
export const COUNTRY_LABEL: Record<string, string> = { GB: "United Kingdom", FR: "France", AT: "Austria", IT: "Italy" };
