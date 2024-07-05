import SyriaAirBases from "../../data/airbases/syria.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Syria: DCSMap = {
  name: "Syria",
  center: [35.57, 35.69],
  magDec: 5,
  airports: convertRawAirBaseData(SyriaAirBases),
};
