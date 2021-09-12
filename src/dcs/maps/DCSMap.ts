import { RawAirbaseData } from "../../types/airbase";

export type DCSMap = {
  name: string;
  center: [number, number];
  magDec: number;
  airports: Array<Airport>;
};

export type Airport = {
  name: string;
  // latitude, longitude, elevation (ft)
  position: [number, number, number];
  runways?: Array<Runway>;
};

export type Runway = {
  heading: number;
  ils?: number;
};

export function convertRawAirBaseData(
  airBaseData: Record<string, unknown>,
): Array<Airport> {
  return (Object.values(airBaseData) as Array<RawAirbaseData>)
    .map(
      (it) => {
        return {
          name: it.callsign,
          position: it.point,
          runways: it.runways.map((rw) => {
            return {
              heading: Math.round(rw.course),
            };
          }),
        };
      },
    );
}
