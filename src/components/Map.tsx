import { getDistance } from "geolib";
import { divIcon, LatLngExpression } from "leaflet";
import React, { useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMapEvent,
} from "react-leaflet";
import { planes } from "../dcs/aircraft";
import { Syria } from "../dcs/maps/Syria";
import { useKeyPress } from "../hooks/useKeyPress";
import { serverStore } from "../stores/ServerStore";
import {
  EntityTrackPing,
  estimatedAltitudeRate,
  estimatedSpeed,
  trackStore,
} from "../stores/TrackStore";
import { Entity } from "../types/entity";
import { computeBRAA, getBearing } from "../util";
import { MapIcon } from "./MapIcon";

function MapEntityTrail({ track }: { track: Array<EntityTrackPing> }) {
  return (
    <>
      {track.map((ping, idx) => (
        <Marker
          key={ping.time}
          position={ping.position}
          icon={divIcon({
            iconSize: [5, 5],
            className: `bg-gray-100 bg-opacity-${100 - (idx * 10)}`,
          })}
          zIndexOffset={30}
        />
      ))}
    </>
  );
}

export function MapObject(
  { obj, active, setActive, scale }: {
    obj: Entity;
    active: boolean;
    setActive: () => void;
    scale: number;
  },
) {
  const position: LatLngExpression = [obj.latitude, obj.longitude];
  const plane = planes[obj.name];
  const track = trackStore((state) => state.tracks.get(obj.id));

  if (
    obj.types.includes("Ground") ||
    obj.types.length == 0
  ) {
    return <></>;
  }

  const icon = useMemo(() =>
    divIcon({
      html: renderToStaticMarkup(
        <div className="flex flex-row absolute w-64">
          <MapIcon
            obj={obj}
            className="relative bg-opacity-70"
            size={16}
          />
          <div
            className="bg-gray-700 bg-opacity-40 flex flex-col absolute"
            style={{ left: 24, top: -6 }}
          >
            {obj.types.includes("Air") &&
              (
                <>
                  <div className="font-bold text-white">
                    {obj.name}
                    {!obj.pilot.startsWith(obj.group)
                      ? <>{" -"} {obj.pilot}</>
                      : null}
                  </div>
                  <div className="flex flex-row gap-2">
                    <div className="text-pink-300">
                      {Math.floor(
                        (obj.altitude * 3.28084) / 1000,
                      )}
                    </div>
                    {track && (
                      <>
                        <div className="text-green-400">
                          {Math.floor(estimatedSpeed(track))}
                        </div>
                        <div className="text-yellow-400">
                          {Math.floor(estimatedAltitudeRate(track))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            <div>
              {active &&
                (
                  <div className="flex flex-col">
                    <span className="text-red-200">
                      {plane && plane.natoName}
                    </span>
                    <span className="text-gray-100">
                      {JSON.stringify(obj)}
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>,
      ),
      className: "",
    }), [obj.name, obj.group, obj.pilot, active, track]);

  const dirArrowEnd = track && computeBRAA(
    position[0],
    position[1],
    obj.heading,
    // knots -> meters per second -> 30 seconds
    ((estimatedSpeed(track) * 0.514444)) * 30,
  );

  return (
    <>
      {dirArrowEnd && obj.types.includes("Air") && (
        <Polyline
          positions={[
            position,
            dirArrowEnd,
          ]}
          pathOptions={{
            color: obj.coalition !== "Allies" ? "#17c2f6" : "#ff8080",
            weight: 1,
          }}
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
      {track && <MapEntityTrail track={track} />}
    </>
  );
}

function MapObjects() {
  const entities = serverStore((state) =>
    state.entities.valueSeq().filter((k) =>
      (!k.types.includes("Bullseye") || k.coalition !== "Allies") &&
      !k.types.includes("Parachutist")
    )
  );
  const [activeObjectId, setActiveObjectId] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(124);
  const zoomEvent = useMapEvent("zoomend", () => {
    const y = zoomEvent.getSize().y;
    const x = zoomEvent.getSize().x;
    var maxMeters = zoomEvent.containerPointToLatLng([0, y]).distanceTo(
      zoomEvent.containerPointToLatLng([x, y]),
    );
    setScale(maxMeters / x);
  });

  const [braaStartPos, setBraaStartPos] = useState<
    number | [number, number] | null
  >(
    null,
  );
  const [cursorPos, setCursorPos] = useState<number | [number, number] | null>(
    null,
  );
  const isSnapDown = useKeyPress("s");

  useMapEvent("contextmenu", (e) => {});

  useMapEvent("mousemove", (e) => {
    let snappedObject = null;
    if (isSnapDown) {
      snappedObject = entities.map((
        obj,
      ) =>
        [
          obj.id,
          getDistance([obj.latitude, obj.longitude], [
            e.latlng.lat,
            e.latlng.lng,
          ]),
        ] as [number, number]
      ).sort((a, b) => a[1] - b[1]).first();
    }

    if (snappedObject) {
      setCursorPos(
        snappedObject[0],
      );
    } else {
      setCursorPos([e.latlng.lat, e.latlng.lng]);
    }
  });

  const mouseDownEvent = useMapEvent("mousedown", (e) => {
    if (e.originalEvent.button === 2) {
      if (isSnapDown) {
        const snappedObject = entities.sort((
          a,
          b,
        ) =>
          getDistance([a.latitude, a.longitude], [
            e.latlng.lat,
            e.latlng.lng,
          ]) - getDistance([b.latitude, b.longitude], [
            e.latlng.lat,
            e.latlng.lng,
          ])
        ).first();
        if (snappedObject) {
          setBraaStartPos(snappedObject.id);
        }
      } else {
        setBraaStartPos([e.latlng.lat, e.latlng.lng]);
      }
      mouseUpEvent.dragging.disable();
    }
  });

  const braaObj = typeof braaStartPos === "number" &&
    serverStore.getState().entities.get(braaStartPos);
  let braaPos: [number, number] | undefined = undefined;
  if (typeof braaStartPos === "number" && braaObj) {
    braaPos = [braaObj.latitude, braaObj.longitude];
  } else if (Array.isArray(braaStartPos)) {
    braaPos = braaStartPos;
  }

  const cursorObj = typeof cursorPos === "number" &&
    serverStore.getState().entities.get(cursorPos);
  let ourCursorPos: [number, number] | undefined = undefined;
  if (typeof cursorPos === "number" && cursorObj) {
    ourCursorPos = [cursorObj.latitude, cursorObj.longitude];
  } else if (Array.isArray(cursorPos)) {
    ourCursorPos = cursorPos;
  }

  const mouseUpEvent = useMapEvent("mouseup", (e) => {
    if (e.originalEvent.button === 2) {
      mouseDownEvent.dragging.enable();
    }
    if (braaStartPos) {
      setBraaStartPos(null);
    }
  });

  const icon = useMemo(() => {
    if (!braaPos || !ourCursorPos) {
      return null;
    }

    return divIcon({
      html: renderToStaticMarkup(
        <div
          className="absolute text-indigo-300 ml-10 text-xl whitespace-nowrap bg-gray-600 p-2"
        >
          {Math.floor(getBearing(braaPos, ourCursorPos)) +
            Syria.magDec} / {Math.floor(
              getDistance(braaPos, ourCursorPos) * 0.00053995680345572,
            )}NM
        </div>,
      ),
      className: "",
    });
  }, [braaStartPos, cursorPos, entities]);

  return (
    <>
      {entities.map((obj) => (
        <MapObject
          key={obj.id}
          obj={obj}
          active={obj.id === activeObjectId}
          setActive={() =>
            activeObjectId === obj.id
              ? setActiveObjectId(null)
              : setActiveObjectId(obj.id)}
          scale={scale}
        />
      ))}
      {braaPos && ourCursorPos && (
        <>
          <Polyline
            positions={[
              ourCursorPos,
              braaPos,
            ]}
            pathOptions={{
              weight: 2,
              color: "yellow",
            }}
          />
          {icon && (
            <Marker
              position={ourCursorPos}
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
      minZoom={8}
      maxZoom={12}
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
