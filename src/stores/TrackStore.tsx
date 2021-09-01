import Immutable from "immutable";
import create from "zustand";
import { RawEntityData } from "../types/entity";
import { getFlyDistance } from "../util";
import { serverStore } from "./ServerStore";

const DEFAULT_NUM_PREVIOUS_PINGS = 16;

export type TrackOptions = {
  warningRadius?: number;
  threatRadius?: number;
  hideInfo?: boolean;
  watching?: boolean;
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
  return (getFlyDistance(
    pings[0].position,
    pings[pings.length - 1].position,
  ) / seconds) * 3600;
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
}

export function deleteTracks(data: Array<number>) {
  const entities = serverStore.getState().entities;
  console.log(
    "[TrackStore] deleting tracks",
    data.map((it) => entities.get(it)).filter((it) =>
      it !== undefined && it.pilot
    ).map((
      it,
    ) => it!.pilot),
  );
  trackStore.setState((state) => {
    return {
      ...state,
      tracks: state.tracks.deleteAll(data),
      trackOptions: state.trackOptions.deleteAll(data),
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
