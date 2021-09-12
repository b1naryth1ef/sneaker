import CaucasusAirBases from "../../data/airbases/caucasus.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Caucasus: DCSMap = {
  name: "Caucasus",
  center: [44.54, 39.46],
  magDec: -6,
  airports: convertRawAirBaseData(CaucasusAirBases),
};
