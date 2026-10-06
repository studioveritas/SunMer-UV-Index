export async function fetchRivmYearRaw(year: number): Promise<string> {
  const name = year >= 2026 ? `Zonkracht${year}.txt` : `ZonkrachtRIVM${year}.txt`;
  const res = await fetch(`https://data.rivm.nl/data/zonkracht/${name}`);
  if (!res.ok) throw new Error(`${res.status} RIVM ${name}`);
  return res.text();
}
