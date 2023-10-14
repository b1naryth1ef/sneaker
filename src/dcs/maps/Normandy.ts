import NormandyAirBases from "../../data/airbases/normandy.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Normandy: DCSMap = {
  name: "Normandy",
  center: [50.12, 0.3],
  magDec: 1,
  airports: convertRawAirBaseData(NormandyAirBases),
};
