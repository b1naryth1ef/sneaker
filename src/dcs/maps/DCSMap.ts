export type DCSMap = {
  name: string;
  center: [number, number];
  magDec: number;
  airports: Array<Airport>;
};

export type Airport = {
  code?: string;
  name: string;
  // latitude, longitude, elevation (ft)
  position: [number, number, number];
  runways?: Array<Runway>;
};

export type Runway = {
  heading: number;
  ils?: number;
};

export const Georgia: DCSMap = {
  name: "Georgia",
  center: [44.54, 39.46],
  magDec: 6,
  airports: [],
};
