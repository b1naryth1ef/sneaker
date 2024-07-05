import KolaAirBases from "../../data/airbases/kola.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const Kola: DCSMap = {
  name: "Kola",
  center: [67, 26],
  magDec: 13,
  airports: convertRawAirBaseData(KolaAirBases),
};
