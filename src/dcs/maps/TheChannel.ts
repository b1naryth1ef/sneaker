import TheChannelAirBases from "../../data/airbases/thechannel.json";
import { convertRawAirBaseData, DCSMap } from "./DCSMap";

export const TheChannel: DCSMap = {
  name: "TheChannel",
  center: [50.52, 1.35],
  magDec: 1,
  airports: convertRawAirBaseData(TheChannelAirBases),
};
