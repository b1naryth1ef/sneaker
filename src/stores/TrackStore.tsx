import { getPreciseDistance } from "geolib";
import Immutable from "immutable";
import { computeDistanceBetween } from "spherical-geometry-js";
import create from "zustand";
import WarningBeep from "../sounds/warning-beep.mp3";
import { RawEntityData } from "../types/entity";
import { serverStore } from "./ServerStore";

const DEFAULT_NUM_PREVIOUS_PINGS = 16;

export type TrackOptions = {
  warningRadius?: number;
  threatRadius?: number;
  hideInfo?: boolean;
};

export type EntityTrackPing = {
  time: number;
  position: [number, number];
  altitude: number;
  heading: number;
};

type TrackStoreData = {
  tracks: Immutable.Map<number, Array<EntityTrackPing>>;
  trackOptions: Immutable.Map<number, TrackOptions>;
  alertTriggers: Immutable.Set<string>;
  config: { numPreviousPings: number };
};

// Returns the estimated speed (in knots) of an entity based on its track
export function estimatedSpeed(pings: Array<EntityTrackPing>): number {
  if (pings.length < 2) {
    return -1;
  }

  const seconds = (pings[0].time - pings[pings.length - 1].time) / 1000;
  return (getPreciseDistance(
    pings[0].position,
    pings[pings.length - 1].position,
  ) / seconds) * 1.94384;
}

// Returns the estimated altitude rate (in fpm) of an entity based on its track
export function estimatedAltitudeRate(track: Array<EntityTrackPing>): number {
  if (track.length < 2) {
    return -1;
  }

  const seconds = (track[0].time - track[track.length - 1].time) / 1000;
  return ((track[0].altitude - track[track.length - 1].altitude) / seconds) *
    60;
}

function entityTrackPing(entity: RawEntityData): EntityTrackPing {
  return {
    time: (new Date()).getTime(),
    position: [entity.latitude, entity.longitude],
    altitude: entity.altitude,
    heading: entity.heading,
  };
}

export const trackStore = create<TrackStoreData>(() => {
  return {
    tracks: Immutable.Map<number, Array<EntityTrackPing>>(),
    trackOptions: Immutable.Map<number, TrackOptions>(),
    alertTriggers: Immutable.Set<string>(),
    config: {
      numPreviousPings: DEFAULT_NUM_PREVIOUS_PINGS,
    },
  };
});

export function updateTracks(data: Array<RawEntityData>) {
  trackStore.setState((state) => {
    return {
      ...state,
      tracks: state.tracks.withMutations((obj) => {
        for (const entity of data) {
          if (
            !entity.types.includes("Air") ||
            entity.types.includes("Parachutist")
          ) {
            continue;
          }

          const existingPings = obj.get(entity.id) || [];
          obj.set(entity.id, [
            entityTrackPing(entity),
            ...existingPings.slice(0, state.config.numPreviousPings),
          ]);
        }
      }),
    };
  });

  checkAlertTrespass();
}

export function deleteTracks(data: Array<number>) {
  trackStore.setState((state) => {
    return {
      ...state,
      tracks: state.tracks.withMutations((obj) => {
        for (const entityId of data) {
          obj.delete(entityId);
        }
      }),
    };
  });
}

export function setTrackOptions(entityId: number, opts: TrackOptions) {
  trackStore.setState((state) => {
    return {
      ...state,
      trackOptions: state.trackOptions.set(entityId, {
        ...state.trackOptions.get(entityId) || {},
        ...opts,
      }),
    };
  });
}

function checkAlertTrespass() {
  const entities = serverStore.getState().entities;

  return trackStore.setState((state) => {
    return {
      ...state,
      alertTriggers: state.alertTriggers.withMutations((obj) => {
        const alertPoints: Map<[number, string], number> = new Map();
        for (const [entityId, track] of state.tracks.entrySeq()) {
          const entity = entities.get(entityId);
          if (
            !entity || !entity.types.includes("Air") ||
            entity.coalition === "Allies"
          ) {
            continue;
          }

          const opts = state.trackOptions.get(entityId);
          if (!opts) {
            continue;
          }

          if (opts.warningRadius) {
            alertPoints.set([entityId, "warning"], opts.warningRadius);
          }

          if (opts.threatRadius) {
            alertPoints.set([entityId, "threat"], opts.threatRadius);
          }
        }

        for (const triggerKey of obj.keys()) {
          const [alertEntityId, alertType, entityId] = triggerKey.split("-");
          if (entityId === alertEntityId) {
            continue;
          }

          const trackOpts = state.trackOptions.get(parseInt(alertEntityId));
          if (!trackOpts) {
            obj.remove(triggerKey);
            continue;
          }

          let radius;
          if (alertType === "warning") {
            radius = trackOpts.warningRadius;
          } else if (alertType === "threat") {
            radius = trackOpts.threatRadius;
          }

          if (!radius) {
            obj.remove(triggerKey);
            continue;
          }

          const alertEntity = entities.get(parseInt(alertEntityId));
          const entity = entities.get(parseInt(entityId));
          if (
            !entity || !alertEntity || entity.coalition !== "Allies"
          ) {
            continue;
          }

          const d0 = computeDistanceBetween([
            alertEntity.latitude,
            alertEntity.longitude,
          ], [
            entity.latitude,
            entity.longitude,
          ]) *
            0.000621371;

          if (
            d0 > radius
          ) {
            obj.remove(triggerKey);
          }
        }

        for (
          const [[alertEntityId, alertType], radius] of alertPoints
            .entries()
        ) {
          for (const [entityId, track] of state.tracks.entrySeq()) {
            if (entityId === alertEntityId) {
              continue;
            }
            const entity = entities.get(entityId);
            const alertEntity = entities.get(alertEntityId);
            if (!entity || !alertEntity || entity.coalition !== "Allies") {
              continue;
            }

            const d0 = Math.floor(
              computeDistanceBetween([
                entity.latitude,
                entity.longitude,
              ], [
                alertEntity.latitude,
                alertEntity.longitude,
              ]) *
                0.000621371,
            );

            if (
              d0 <= radius &&
              !obj.has(`${alertEntityId}-${alertType}-${entityId}`)
            ) {
              if (alertType === "threat") {
                const audio = new Audio(WarningBeep);
                audio.play();
              }
              obj = obj.add(`${alertEntityId}-${alertType}-${entityId}`);
            }
          }
        }
      }),
    };
  });
}
