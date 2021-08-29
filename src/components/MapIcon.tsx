import ms from "milsymbol";
import React from "react";
import { Entity } from "../types/entity";

const ColorMode = ms.ColorMode(
  "#ffffff",
  "#17c2f6",
  "#ff8080",
  "#ffffff",
  "#ffffff",
);

export function MapIcon(
  { obj, className, size }: {
    obj: Entity;
    className?: string;
    size?: number;
  },
): JSX.Element {
  if (obj.types.length === 0) {
    return <></>;
  }

  const svg = new ms.Symbol(obj.sidc, {
    size: size || 26,
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
