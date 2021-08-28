import { divIcon, LatLngExpression } from "leaflet";
import ms from "milsymbol";
import React, { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvent,
} from "react-leaflet";
import {
  generateSIDC,
  ObjectMetadata,
  serverStore,
} from "../stores/ServerStore";
import { computeBRAA } from "../util";

const ColorMode = ms.ColorMode(
  "#ffffff",
  "#17c2f6",
  "#ff8080",
  "#ffffff",
  "#ffffff",
);

function MapIcon(
  { obj, className }: {
    obj: ObjectMetadata;
    className?: string;
  },
) {
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
      style={{ "transform": "translateX(-50%)" }}
    />
  );
}

export function MapObject(
  { obj, active, setActive, zoom }: {
    obj: ObjectMetadata;
    active: boolean;
    setActive: () => void;
    zoom: number;
  },
) {
  const position: LatLngExpression = [obj.latitude, obj.longitude];

  if (
    obj.types.includes("Ground") ||
    obj.types.length == 0
  ) {
    return <></>;
  }

  const icon = divIcon({
    html: renderToStaticMarkup(
      <div className="flex flex-row absolute w-64 items-center">
        <MapIcon
          obj={obj}
          className="absolute"
        />
        <div
          className="bg-gray-700 bg-opacity-40 text-white flex flex-col absolute"
          style={{ left: 36 }}
        >
          <div>
            {obj.name}
            {!obj.pilot.startsWith(obj.group) ? <>{" -"} {obj.pilot}</> : null}
          </div>
          <div>
            {active &&
              (
                <span className="text-gray-100">
                  {JSON.stringify(obj)}
                </span>
              )}
          </div>
        </div>
      </div>,
    ),
    className: "yeet",
  });

  const dirArrowEnd = computeBRAA(
    position[0],
    position[1],
    obj.heading,
    30000 - (zoom * 2000),
  );

  return (
    <>
      {obj.types.includes("Air") && (
        <Polyline
          positions={[
            position,
            dirArrowEnd,
          ]}
          pathOptions={{ color: "white", weight: 1 }}
        />
      )}
      <Marker
        position={position}
        icon={icon}
        eventHandlers={{
          click: () => {
            setActive();
          },
        }}
      />
    </>
  );
}

function MapObjects() {
  const objects = serverStore((state) => state.objects);
  const [activeObjectId, setActiveObjectId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(9);
  const map = useMapEvent("zoom", () => {
    setZoom(map.getZoom());
  });

  return (
    <>
      {objects.valueSeq().map((obj) => (
        <MapObject
          key={obj.id}
          obj={obj}
          active={obj.id === activeObjectId}
          setActive={() =>
            activeObjectId === obj.id
              ? setActiveObjectId(null)
              : setActiveObjectId(obj.id)}
          zoom={zoom}
        />
      ))}
    </>
  );
}

export default function Map(): JSX.Element {
  const position: LatLngExpression = [36.10, 35.36];

  return (
    <MapContainer
      center={position}
      zoom={9}
      minZoom={9}
      maxZoom={14}
      scrollWheelZoom={true}
      className="h-full w-full relative"
    >
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
      />
      <MapObjects />
    </MapContainer>
  );
}
