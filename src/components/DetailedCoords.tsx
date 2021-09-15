import * as mgrs from "mgrs";
import React from "react";
import { formatDDM, formatDMS } from "../util";

export default function DetailedCoords(
  { coords }: { coords: [number, number] },
) {
  return (
    <>
      <div className="flex flex-row w-full">
        <span className="pr-2 flex-grow">DMS</span>
        <span className="select-text font-mono">{formatDMS(coords)}</span>
      </div>
      <div className="flex flex-row w-full">
        <span className="pr-2 flex-grow">DDM</span>
        <span className="select-text font-mono">{formatDDM(coords)}</span>
      </div>
      <div className="flex flex-row w-full">
        <span className="pr-2 flex-grow">MGRS</span>
        <span className="select-text font-mono">
          {mgrs.forward([coords[1], coords[0]])}
        </span>
      </div>
    </>
  );
}
