import CaucasusAirBases from "../../data/airbases/caucasus.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Caucasus: DCSMap = {
  name: "Caucasus",
  center: [43.53, 41.11],
  magDec: -6,
  airports: convertRawAirBaseData(CaucasusAirBases),
};
