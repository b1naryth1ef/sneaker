import FalklandsAirBases from "../../data/airbases/falklands.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Falklands: DCSMap = {
  name: "Falklands",
  center: [-52.05, -64.42],
  magDec: 6,
  airports: convertRawAirBaseData(FalklandsAirBases),
};
