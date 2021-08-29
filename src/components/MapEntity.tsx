import { divIcon, LatLngExpression } from "leaflet";
import React, { useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Marker, Polyline } from "react-leaflet";
import { planes } from "../dcs/aircraft";
import {
  EntityTrackPing,
  estimatedAltitudeRate,
  estimatedSpeed,
  trackStore,
} from "../stores/TrackStore";
import { Entity } from "../types/entity";
import { computeBRAA } from "../util";
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

function MapEntityInner({ entity }: { entity: Entity }) {
  if (entity.types.includes("Air")) {
    return <></>;
  }

  return (
    <div className="flex flex-row absolute w-64">
      <MapIcon
        obj={entity}
        className="relative bg-opacity-70"
        size={16}
      />
    </div>
  );
}

function MapTrackedEntityInner(
  { entity, active, track }: {
    entity: Entity;
    active: boolean;
    track: Array<EntityTrackPing>;
  },
) {
  const plane = planes[entity.name];
  const speed = estimatedSpeed(track);

  // Not visible to our radar
  if (speed === -1 || speed < 15) {
    return <></>;
  }

  return (
    <div className="flex flex-row absolute w-64">
      <MapIcon
        obj={track.length < 5 ? "SPA-------" : entity}
        className="relative bg-opacity-70"
        size={16}
      />
      <div
        className="bg-gray-700 bg-opacity-40 flex flex-col absolute"
        style={{ left: 24, top: -6 }}
      >
        {entity.types.includes("Air") && track.length >= 5 &&
          (
            <>
              <div className="font-bold text-white">
                {entity.name}
                {!entity.pilot.startsWith(entity.group)
                  ? <>{" -"} {entity.pilot}</>
                  : null}
              </div>
              <div className="flex flex-row gap-2">
                <div className="text-pink-300">
                  {Math.floor(
                    (entity.altitude * 3.28084) / 1000,
                  )}
                </div>
                <>
                  <div className="text-green-400">
                    {Math.floor(estimatedSpeed(track))}
                  </div>
                  <div className="text-yellow-400">
                    {Math.floor(estimatedAltitudeRate(track))}
                  </div>
                </>
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
                  {JSON.stringify(entity)}
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export function MapEntity(
  { entity, active, setActive, scale }: {
    entity: Entity;
    active: boolean;
    setActive: () => void;
    scale: number;
  },
) {
  const position: LatLngExpression = [entity.latitude, entity.longitude];
  const track = trackStore((state) => state.tracks.get(entity.id));

  if (
    entity.types.includes("Ground") ||
    entity.types.length == 0
  ) {
    return <></>;
  }

  // console.log(track && track.length > 0 && estimatedAltitudeRate(track));
  // console.log(track && track.length > 0 && estimatedSpeed(track));

  const icon = useMemo(() =>
    divIcon({
      html: renderToStaticMarkup(
        track !== undefined
          ? (
            <MapTrackedEntityInner
              entity={entity}
              track={track}
              active={active}
            />
          )
          : <MapEntityInner entity={entity} />,
      ),
      className: "",
    }), [entity, active, track]);

  const speed = track && estimatedSpeed(track);
  const dirArrowEnd = speed && speed >= 15 && computeBRAA(
    position[0],
    position[1],
    entity.heading,
    // knots -> meters per second -> 30 seconds
    ((speed * 0.514444)) * 30,
  );

  return (
    <>
      {dirArrowEnd && entity.types.includes("Air") && (
        <Polyline
          positions={[
            position,
            dirArrowEnd,
          ]}
          pathOptions={{
            color: entity.coalition !== "Allies" ? "#17c2f6" : "#ff8080",
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
      {track && track.length >= 5 && speed && speed > 15 &&
        <MapEntityTrail track={track} />}
    </>
  );
}
