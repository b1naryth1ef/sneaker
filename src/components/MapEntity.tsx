import * as maptalks from "maptalks";
import ms from "milsymbol";
import React, { useEffect } from "react";
import {
  EntityTrackPing,
  estimatedSpeed,
  setTrackOptions,
  trackStore,
} from "../stores/TrackStore";
import { Entity } from "../types/entity";
import { getCardinal } from "../util";
import { colorMode } from "./MapIcon";

export const iconCache: Record<string, string> = {};

export function EntityInfo(
  { map, entity, track }: {
    map: maptalks.Map;
    entity: Entity;
    track: Array<EntityTrackPing>;
  },
) {
  const trackOptions = trackStore((state) => state.trackOptions.get(entity.id));

  return (
    <div
      className="m-2 absolute flex flex-col bg-gray-300 border border-gray-500 shadow select-none rounded-sm"
    >
      <div className="p-2 bg-gray-400 text-sm">
        <b>{entity.group}</b>
      </div>
      <div className="p-2 flex flex-row">
        <div className="flex flex-col pr-2">
          <div>{entity.name}</div>
          <div>{entity.pilot}</div>
          <div>
            Heading: {Math.round(entity.heading)}
            {getCardinal(entity.heading)}
          </div>
          <div>Altitude: {Math.round(entity.altitude * 3.28084)}</div>
          <div>GS: {Math.round(estimatedSpeed(track))}</div>
        </div>
        <div
          className="flex flex-col border-l border-black px-2 gap-1 flex-grow"
        >
          <button
            className="p-1 text-xs bg-blue-300 border border-blue-400"
            onClick={() => {
              map.animateTo({
                center: [entity.longitude, entity.latitude],
                zoom: 10,
              }, {
                duration: 250,
                easing: "out",
              });
            }}
          >
            Snap
          </button>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row flex-grow">
              <span className="text-yellow-600 pr-2 flex-grow">WR</span>
              <input
                className="w-16"
                value={trackOptions?.warningRadius || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== NaN) {
                    setTrackOptions(entity.id, {
                      warningRadius: val,
                    });
                  }
                }}
              />
            </div>
            <div className="flex flex-row flex-grow">
              <span className="text-red-600 pr-2 flex-grow">TR</span>
              <input
                className="w-16"
                value={trackOptions?.threatRadius || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== NaN) {
                    setTrackOptions(entity.id, {
                      threatRadius: val,
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MapSimpleEntity(
  { map, entity, size, strokeWidth }: {
    map: maptalks.Map;
    entity: Entity;
    size?: number;
    strokeWidth?: number;
  },
) {
  useEffect(() => {
    const iconLayer = map.getLayer("track-icons") as maptalks.VectorLayer;
    let marker = iconLayer.getGeometryById(
      entity.id,
    ) as maptalks.Marker;
    if (!marker) {
      if (iconCache[entity.sidc] === undefined) {
        iconCache[entity.sidc] = new ms.Symbol(entity.sidc, {
          size: size || 16,
          frame: true,
          fill: false,
          colorMode: colorMode,
          strokeWidth: strokeWidth || 8,
        }).toDataURL();
      }
      marker = new maptalks.Marker(
        [entity.longitude, entity.latitude],
        {
          id: entity.id,
          draggable: false,
          visible: true,
          editable: false,
          symbol: {
            markerFile: iconCache[entity.sidc],
            markerDy: 10,
          },
        },
      );
      iconLayer.addGeometry(
        marker,
      );
    } else {
      marker.setCoordinates([
        entity.longitude,
        entity.latitude,
      ]);
    }
  }, [entity]);

  return <></>;
}
