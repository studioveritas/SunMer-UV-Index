/** Half-sun geometry shared by the page glyph and the share card. Rays: 8 at UV 0, 32 at UV 12+. */
export function sunGlyph(uvi: number | null) {
  const u = Math.max(0, Math.min(12, uvi ?? 0));
  const rays = 8 + Math.round(u * 2);
  const reach = 0.62 + (u / 12) * 0.38;
  const cx = 160, cy = 110, r = 34;
  const paths = Array.from({ length: rays + 1 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / rays;
    const len = (i % 2 ? 0.78 : 1) * 118 * reach;
    const w = 4.2;
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
    const b1 = [cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w];
    const b2 = [cx + Math.cos(a - Math.PI / 2) * w, cy + Math.sin(a - Math.PI / 2) * w];
    return `M${b1[0].toFixed(1)} ${b1[1].toFixed(1)} L${tip[0].toFixed(1)} ${tip[1].toFixed(1)} L${b2[0].toFixed(1)} ${b2[1].toFixed(1)} Z`;
  });
  paths.push(`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Z`);
  return { rays, paths, viewBox: "20 0 280 114", horizon: { x: 24, y: cy - 1, w: 272, h: 2.5 } };
}

export function sunGlyphSvg(uvi: number | null, color: string): string {
  const g = sunGlyph(uvi);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.viewBox}"><g fill="${color}">${g.paths.map((d) => `<path d="${d}"/>`).join("")}<rect x="${g.horizon.x}" y="${g.horizon.y}" width="${g.horizon.w}" height="${g.horizon.h}"/></g></svg>`;
}

export function moonGlyphSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 0 280 114"><path fill="${color}" d="M170 14a48 48 0 1 0 38 78 40 40 0 1 1-38-78z"/><rect x="24" y="109" width="272" height="2.5" fill="${color}"/></svg>`;
}
