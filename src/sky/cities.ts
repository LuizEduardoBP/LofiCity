/* Cities the app can show. Each one brings its clock, its place on the globe (for the sun,
   the moon and the live weather), its climate model and its own scenes. */

export type CityId = 'tokyo' | 'esperanca';
export type Climate = 'japan' | 'agreste';

export interface City {
  id: CityId;
  /** Name shown in the HUD and the selector. */
  name: string;
  /** Fixed UTC offset in hours (neither city observes daylight saving). */
  utc: number;
  lat: number;
  lon: number;
  climate: Climate;
}

export const CITIES: City[] = [
  { id: 'tokyo', name: 'Tóquio', utc: 9, lat: 35.68, lon: 139.69, climate: 'japan' },
  // Esperança, Paraíba: Agreste on the Borborema plateau (~630 m), Brasília time.
  { id: 'esperanca', name: 'Esperança · PB', utc: -3, lat: -7.02, lon: -35.86, climate: 'agreste' },
];

export const cityById = (id: string | null | undefined): City => CITIES.find((c) => c.id === id) ?? CITIES[0];

/** Festa de Nossa Senhora do Bom Conselho: about 16 days from early January, procession on the last night. */
export const FESTA_PADROEIRA = { from: [0, 5] as const, to: [0, 20] as const };
