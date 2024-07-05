import SinaiAirBases from "../../data/airbases/sinaimap.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Sinai: DCSMap = {
  name: "Sinai",
  center: [30, 32],
  magDec: 5,
  airports: convertRawAirBaseData(SinaiAirBases),
};
