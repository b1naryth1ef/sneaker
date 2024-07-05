import PersianGulfAirBases from "../../data/airbases/persiangulf.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const PersianGulf: DCSMap = {
  name: "Persian Gulf",
  center: [26.10, 55.48],
  magDec: 2,
  airports: convertRawAirBaseData(PersianGulfAirBases),
};
