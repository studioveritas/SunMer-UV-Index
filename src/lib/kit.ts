import type { Spot } from "./config/spots";
import type { SpotUv } from "./spotService";
import { lensFor, wetsuitFor } from "./exposure";

/** What to wear and apply, from the sport, surface, altitude and UV. Short lines, one idea each. */
export function kitFor(s: SpotUv): { label: string; value: string }[] {
  const { spot, surface, uv, headlineM, conditions } = s;
  const peak = uv.consensus.todayMax;
  const lens = lensFor(surface, peak, spot.summit ?? headlineM);
  if (spot.kind === "ski") {
    return [
      { label: "Goggles", value: lens },
      { label: "Face", value: "SPF 50: nose, ears, under the chin" },
      { label: "Lips", value: "SPF lip balm" },
      { label: "Reapply", value: "Every 2 hours, and after wiping your face" },
      { label: "Gap", value: "Cover the strip between goggles and helmet" },
    ];
  }
  if (spot.kind === "surf") {
    const suit = wetsuitFor(conditions.seaC);
    return [
      ...(suit ? [{ label: "Wetsuit", value: suit.suit }, { label: "Exposed", value: suit.exposed }] : []),
      { label: "Sunscreen", value: "Very water resistant SPF 50 (tested 4 × 20 min)" },
      { label: "Reapply", value: "Between sessions; water and towels take it off" },
      { label: "Eyes", value: `${lens} on the beach; surfer's eye builds over years` },
    ];
  }
  return [
    { label: "Sunglasses", value: lens },
    { label: "Sunscreen", value: "SPF 30+, water resistant if you swim" },
    { label: "Shade", value: "Sand bounces 15–25% back up: a parasol is not enough" },
    { label: "Reapply", value: "Every 2 hours and after swimming" },
  ];
}

export function headlineLabel(spot: Spot): string {
  return spot.kind === "ski" ? "on the slopes" : spot.kind === "surf" ? "in the water" : "on the beach";
}
