export type RawRunwayData = {
  Name: number;
  course: number;
  length: number;
  width: number;
};

export type RawAirbaseData = {
  callsign: string;
  cat: number;
  desc: {
    attributes: Record<string, unknown>;
    category: number;
    displayName: string;
    life: number;
    typeName: string;
  };
  point: [number, number, number];
  id: number;
  runways: Array<RawRunwayData>;
};
