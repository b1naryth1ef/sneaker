import ms from "milsymbol";
import React from "react";
import { generateSIDC, ObjectMetadata } from "../stores/ServerStore";

const ColorMode = ms.ColorMode(
  "#ffffff",
  "#17c2f6",
  "#ff8080",
  "#ffffff",
  "#ffffff",
);

export function MapIcon(
  { obj, className }: {
    obj: ObjectMetadata;
    className?: string;
  },
): JSX.Element {
  if (obj.types.length === 0) {
    return <></>;
  }

  const svg = new ms.Symbol(generateSIDC(obj), {
    size: 26,
    frame: true,
    fill: false,
    colorMode: ColorMode,
    strokeWidth: 8,
  }).asSVG();
  return (
    <span
      dangerouslySetInnerHTML={{ __html: svg }}
      className={className}
      style={{ "transform": "translateX(-40%) translateY(-45%)" }}
    />
  );
}
