import { getDistance, getGreatCircleBearing } from "geolib";
import { divIcon, LatLng, LatLngExpression } from "leaflet";
import ms from "milsymbol";
import React, { useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvent,
} from "react-leaflet";
import { Syria } from "../maps/Syria";
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
      style={{ "transform": "translateX(-40%) translateY(-45%)" }}
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

  const icon = useMemo(() =>
    divIcon({
      html: renderToStaticMarkup(
        <div className="flex flex-row absolute w-64 items-center">
          <MapIcon
            obj={obj}
            className="relative bg-opacity-70"
          />
          <div
            className="bg-gray-700 bg-opacity-40 text-white flex flex-col absolute"
            style={{ left: 36 }}
          >
            {obj.types.includes("Air") &&
              (
                <div>
                  {obj.name}
                  {!obj.pilot.startsWith(obj.group)
                    ? <>{" -"} {obj.pilot}</>
                    : null}
                </div>
              )}
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
      className: "",
    }), [obj.name, obj.group, obj.pilot, active, zoom]);

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
        zIndexOffset={0}
      />
    </>
  );
}

function MapObjects() {
  const objects = serverStore((state) =>
    state.objects.valueSeq().filter((k) =>
      !k.types.includes("Bullseye") || k.coalition !== "Allies"
    )
  );
  const [activeObjectId, setActiveObjectId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(9);
  const zoomEvent = useMapEvent("zoom", () => {
    setZoom(zoomEvent.getZoom());
  });

  const [braaStartPos, setBraaStartPos] = useState<LatLng | null>(null);
  const [cursorPos, setCursorPos] = useState<LatLng | null>(null);

  useMapEvent("contextmenu", (e) => {});

  useMapEvent("mousemove", (e) => {
    setCursorPos(e.latlng);
  });

  const mouseDownEvent = useMapEvent("mousedown", (e) => {
    if (e.originalEvent.button === 2) {
      mouseUpEvent.dragging.disable();
      setBraaStartPos(e.latlng);
    }
  });

  const mouseUpEvent = useMapEvent("mouseup", (e) => {
    if (braaStartPos) {
      setBraaStartPos(null);
      mouseDownEvent.dragging.enable();
    }
  });

  const icon = useMemo(() =>
    braaStartPos && cursorPos
      ? divIcon({
        html: renderToStaticMarkup(
          <div
            className="absolute text-indigo-300 ml-10 text-xl whitespace-nowrap bg-gray-600 p-2"
          >
            {Math.floor(getGreatCircleBearing(braaStartPos, cursorPos)) +
              Syria.magDec} / {Math.floor(
                getDistance(braaStartPos, cursorPos) * 0.00053995680345572,
              )}NM
          </div>,
        ),
        className: "",
      })
      : null, [braaStartPos, cursorPos]);

  return (
    <>
      {objects.map((obj) => (
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
      {braaStartPos !== null && cursorPos !== null && (
        <>
          <Polyline
            positions={[
              cursorPos,
              braaStartPos,
            ]}
            pathOptions={{
              weight: 1,
              color: "white",
            }}
          />
          {icon && (
            <Marker
              position={cursorPos}
              icon={icon}
              zIndexOffset={30}
            />
          )}
        </>
      )}
    </>
  );
}

export default function Map(): JSX.Element {
  return (
    <MapContainer
      doubleClickZoom={false}
      center={Syria.center as LatLngExpression}
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
