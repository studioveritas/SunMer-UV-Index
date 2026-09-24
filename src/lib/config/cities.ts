import type { City } from "../types";

/**
 * 20 cities: Benelux core, UK, France, then key European reference points.
 * Kept at 20 on purpose: at a 180-minute refresh this fits inside the
 * Met Office free tier (360 calls/day). Add cities => raise the refresh
 * interval or move to a paid Met Office plan.
 */
export const CITIES: City[] = [
  // Benelux
  { slug: "amsterdam", name: "Amsterdam", country: "NL", lat: 52.3676, lon: 4.9041, tz: "Europe/Amsterdam", dwdNames: ["Amsterdam"] },
  { slug: "rotterdam", name: "Rotterdam", country: "NL", lat: 51.9244, lon: 4.4777, tz: "Europe/Amsterdam" },
  { slug: "brussels", name: "Brussels", country: "BE", lat: 50.8503, lon: 4.3517, tz: "Europe/Brussels", dwdNames: ["Brüssel", "Bruessel"] },
  { slug: "luxembourg", name: "Luxembourg", country: "LU", lat: 49.6116, lon: 6.1319, tz: "Europe/Luxembourg", dwdNames: ["Luxemburg"] },
  // UK & Ireland
  { slug: "london", name: "London", country: "GB", lat: 51.5072, lon: -0.1276, tz: "Europe/London", dwdNames: ["London"] },
  { slug: "manchester", name: "Manchester", country: "GB", lat: 53.4808, lon: -2.2426, tz: "Europe/London" },
  { slug: "edinburgh", name: "Edinburgh", country: "GB", lat: 55.9533, lon: -3.1883, tz: "Europe/London" },
  { slug: "dublin", name: "Dublin", country: "IE", lat: 53.3498, lon: -6.2603, tz: "Europe/Dublin", dwdNames: ["Dublin"] },
  // France
  { slug: "paris", name: "Paris", country: "FR", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris", dwdNames: ["Paris"] },
  { slug: "lyon", name: "Lyon", country: "FR", lat: 45.764, lon: 4.8357, tz: "Europe/Paris" },
  { slug: "marseille", name: "Marseille", country: "FR", lat: 43.2965, lon: 5.3698, tz: "Europe/Paris" },
  { slug: "nice", name: "Nice", country: "FR", lat: 43.7102, lon: 7.262, tz: "Europe/Paris", dwdNames: ["Nizza"] },
  // Key European reference cities
  { slug: "berlin", name: "Berlin", country: "DE", lat: 52.52, lon: 13.405, tz: "Europe/Berlin", dwdNames: ["Berlin"] },
  { slug: "munich", name: "Munich", country: "DE", lat: 48.1351, lon: 11.582, tz: "Europe/Berlin", dwdNames: ["München", "Muenchen"] },
  { slug: "copenhagen", name: "Copenhagen", country: "DK", lat: 55.6761, lon: 12.5683, tz: "Europe/Copenhagen", dwdNames: ["Kopenhagen"] },
  { slug: "madrid", name: "Madrid", country: "ES", lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid", dwdNames: ["Madrid"] },
  { slug: "barcelona", name: "Barcelona", country: "ES", lat: 41.3874, lon: 2.1686, tz: "Europe/Madrid", dwdNames: ["Barcelona"] },
  { slug: "lisbon", name: "Lisbon", country: "PT", lat: 38.7223, lon: -9.1393, tz: "Europe/Lisbon", dwdNames: ["Lissabon"] },
  { slug: "rome", name: "Rome", country: "IT", lat: 41.9028, lon: 12.4964, tz: "Europe/Rome", dwdNames: ["Rom"] },
  { slug: "athens", name: "Athens", country: "GR", lat: 37.9838, lon: 23.7275, tz: "Europe/Athens", dwdNames: ["Athen"] },
];

export function getCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
