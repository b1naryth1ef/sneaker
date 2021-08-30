import ms from "milsymbol";
import React from "react";
import { Entity } from "../types/entity";

export const colorMode: ms.ColorMode = ms.ColorMode(
  "#ffffff",
  "#17c2f6",
  "#ff8080",
  "#ffffff",
  "#ffffff",
);

export function MapIcon(
  { obj, className, size }: {
    obj: Entity | string;
    className?: string;
    size?: number;
  },
): JSX.Element {
  if (typeof obj === "object" && obj.types.length === 0) {
    return <></>;
  }

  const svg = new ms.Symbol(typeof obj === "object" ? obj.sidc : obj, {
    size: size || 26,
    frame: true,
    fill: false,
    colorMode: colorMode,
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
