import type { ProviderId } from "../types";
import type { Provider } from "./base";
import { metOffice } from "./metOffice";
import { knmiTemis } from "./knmiTemis";
import { metNorway } from "./metNorway";
import { cams } from "./cams";
import { dwd } from "./dwd";
import { meteoFrance } from "./meteoFrance";

/**
 * Order matters for display only. The three "core" national services
 * are listed first: Met Office (UK), KNMI (NL), MET Norway.
 * CAMS, DWD and Météo-France add depth and regional authority.
 */
export const PROVIDERS: Provider[] = [metOffice, knmiTemis, metNorway, cams, dwd, meteoFrance];

export const CORE_PROVIDERS: ProviderId[] = ["met-office", "knmi-temis", "met-norway"];

export function getProvider(id: ProviderId): Provider | undefined {
  return PROVIDERS.find((p) => p.meta.id === id);
}
