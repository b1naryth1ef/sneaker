import NormandyAirBases from "../../data/airbases/normandy.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Normandy: DCSMap = {
  name: "Normandy",
  center: [50.7, 0.25],
  magDec: 1,
  airports: convertRawAirBaseData(NormandyAirBases),
};
