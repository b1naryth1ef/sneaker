import AfghanistanAirBases from "../../data/airbases/afghanistan.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Afghanistan: DCSMap = {
  name: "Afghanistan",
  center: [33, 64],
  magDec: 3,
  airports: convertRawAirBaseData(AfghanistanAirBases),
};
