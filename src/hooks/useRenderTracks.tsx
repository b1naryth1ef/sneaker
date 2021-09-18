import * as maptalks from "maptalks";
import { useEffect } from "react";
import { syncVisibility } from "../components/Map";
import { TrackField } from "../stores/ProfileStore";
import { serverStore } from "../stores/ServerStore";
import {
  EntityTrackPing,
  estimatedAltitudeRate,
  estimatedSpeed,
  isTrackVisible,
  TrackOptions,
  trackStore,
  TrackStoreData
} from "../stores/TrackStore";
import { Entity } from "../types/entity";

export const trackIconCache: Record<string, string> = {};

type TrackStateSlice = [
  TrackStoreData["tracks"],
  TrackStoreData["trackOptions"],
];

function updateTrackField(
  field: TrackField,
  entity: Entity,
  track: Array<EntityTrackPing>,
  item: maptalks.Label,
) {
  if (field.type === "altitude") {
    let altitude = entity.altitude;
    if (field.unit === "feet") {
      altitude = altitude * 3.28084;
    }
    altitude = altitude / 1000;

    const altStr = altitude.toFixed(field.decimalPlaces).toString();
    (item.setContent as any)(
      `${"0".repeat(field.minPlaces - altStr.split(".")[0].length)}${altStr}`,
    );
  } else if (field.type === "ground-speed") {
    const speed = estimatedSpeed(track);
    let speedText;
    if (field.unit === "knots") {
      speedText = Math.round(speed * 0.539957).toString();
    } else if (field.unit === "mach") {
      // TODO: better mach calculation
      speedText = (speed * 0.0009414715).toFixed(1);
    } else if (field.unit === "kph") {
      speedText = Math.round(speed).toString()
    }

    (item.setContent as any)(speedText);
  } else if (field.type === "vertical-speed") {
    const altSpeed = estimatedAltitudeRate(track);
    let altText;

    if (field.unit === "fpm") {
      altText = Math.round(altSpeed * 3.28084)
    } else if (field.unit === "visual") {
      altText = (altSpeed > 0) ? "⬆️" : "️⬇️";
    }

    (item.setContent as any)(altText);
  }
}

function renderTrack(
  layer: maptalks.VectorLayer,
  entity: Entity,
  track: Array<EntityTrackPing>,
  trackOptions?: TrackOptions,
) {
  const trackFields: Array<TrackField> = [
    {
      type: "altitude",
      unit: "feet",
      minPlaces: 2,
      decimalPlaces: 1,
      color: "red",
    },
    {
      type: "ground-speed",
      unit: "knots",
      color: "orange",
    },
    {
      type: "vertical-speed",
      unit: "fpm",
      color: "green",
    },
  ];

  let collection = layer.getGeometryById(
    entity.id,
  ) as maptalks.GeometryCollection;
  let items = collection
    ? collection.getGeometries() as Array<maptalks.Label>
    : [];
    
  let idx = 0;
  let offset = 20;
  for (const trackField of trackFields) {
    let item = items[idx];
    idx += 1;

    if (item === undefined) {
      item = new maptalks.Label("", [0, 0], {
        visible: true,
        draggable: false,
        editable: false,
        boxStyle: {
          "padding": [2, 2],
          "horizontalAlignment": "left",
          "symbol": {
            "markerType": "square",
            "markerFillOpacity": 0,
            "markerLineOpacity": 0,
            textHorizontalAlignment: "right",
            textDx: 20,
            textDy: 18,
          },
        },
        textSymbol: {
          textFaceName: '"Gill Sans", sans-serif',
          textSize: 12,
        },
      });
      items = [...items, item];
    }

    updateTrackField(trackField, entity, track, item);
    item.setCoordinates([
      entity.longitude,
      entity.latitude,
    ]);

    const size = item.getSize();

    if (
      offset != item.options.boxStyle.symbol.textDx ||
      (trackField.color &&
        item.options.textSymbol.textFill !== trackField.color)
    ) {
      item.updateSymbol({
        ...item.getSymbol(),
        textDx: offset,
        textFill: trackField.color,
      });
    }

    offset += size ? (size.width + 5) : 0;
  }

  if (!collection) {
    collection = new maptalks.GeometryCollection(items, {
      id: entity.id,
      draggable: false,
    });
    layer.addGeometry(collection);
  }
  syncVisibility(collection, isTrackVisible(track));

}

function renderTracks(
  map: maptalks.Map,
  [tracks, trackOptions]: TrackStateSlice,
) {
  const layer = map.getLayer("tracks") as maptalks.VectorLayer;

  for (const geo of layer.getGeometries()) {
    const track = tracks.get((geo as any)._id as number);
    if (!track) {
      geo.remove();
    }
  }

  const { entities } = serverStore.getState();
  for (const [entityId, track] of tracks.entrySeq()) {
    const entity = entities.get(entityId);
    if (!entity) {
      continue;
    }
    renderTrack(layer, entity, track, trackOptions.get(entityId));
  }
}

export default function useRenderTracks(
  map: maptalks.Map | null,
) {
  useEffect(() => {
    if (!map) return;

    // Force render the first time
    const { tracks, trackOptions } = trackStore.getState();
    renderTracks(map, [tracks, trackOptions]);

    return trackStore.subscribe(
      (
        newState: TrackStateSlice,
      ) => renderTracks(map, newState),
      (
        state,
      ) =>
        [
          state.tracks,
          state.trackOptions,
        ] as TrackStateSlice,
    );
  }, [map]);
}
