import Immutable from "immutable";
import create from "zustand";
import {
  SneakerInitialStateEvent,
  SneakerRadarSnapshotEvent,
} from "../SneakerClient";
import { RawEntityData } from "../types/entity";
import { getFlyDistance } from "../util";
import { entityMetadataStore } from "./EntityMetadataStore";
import { getProfilesForTags } from "./ProfileStore";

const DEFAULT_NUM_PREVIOUS_PINGS = 16;

export type TrackOptions = {
  warningRadius?: number;
  threatRadius?: number;
  profileWarningRadius?: number;
  profileThreatRadius?: number;
  hideInfo?: boolean;
  watching?: boolean;
};

export type EntityTrackPing = {
  time: number;
  position: [number, number];
  altitude: number;
  heading: number;
};

export type TrackProfileData = {
  warningRadius?: number;
  threatRadius?: number;
};

export type TrackStoreData = {
  tracks: Immutable.Map<number, Array<EntityTrackPing>>;
  trackOptions: Immutable.Map<number, TrackOptions>;
  alertTriggers: Immutable.Set<string>;
  config: { numPreviousPings: number };
};

export function isTrackVisible(track: Array<EntityTrackPing>): boolean {
  return track.length >= 3 && estimatedSpeed(track) >= 25;
}

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

(window as any).trackStore = trackStore;

function isEntityTrackable(entity: RawEntityData) {
  return (
    entity.types.includes("Air") &&
    !entity.types.includes("Parachutist")
  );
}

export function createTracks(event: SneakerInitialStateEvent) {
  trackStore.setState((state) => {
    return {
      ...state,
      tracks: Immutable.Map<number, Array<EntityTrackPing>>(
        event.d.objects?.filter((obj) => isEntityTrackable(obj)).map((
          obj,
        ) => [obj.id, [entityTrackPing(obj)]]) || [],
      ),
    };
  });
}

export function updateTracks(event: SneakerRadarSnapshotEvent) {
  trackStore.setState((state) => {
    return {
      ...state,
      tracks: state.tracks.withMutations((obj) => {
        for (const entity of event.d.created) {
          if (!isEntityTrackable(entity)) continue;
          obj.set(entity.id, [
            entityTrackPing(entity),
          ]);
        }
        for (const entity of event.d.updated) {
          if (!isEntityTrackable(entity)) continue;

          const existingPings = obj.get(entity.id) || [];
          obj.set(entity.id, [
            entityTrackPing(entity),
            ...existingPings.slice(0, state.config.numPreviousPings),
          ]);
        }

        obj.deleteAll(event.d.deleted);
      }),
      trackOptions: state.trackOptions.deleteAll(event.d.deleted),
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

setTimeout(() => {
  const state = entityMetadataStore.getState();
  trackStore.setState((trackState) => {
    return {
      ...trackState,
      trackOptions: trackState.trackOptions.withMutations((obj) => {
        for (const [entityId, metadata] of state.entities) {
          const profile = getProfilesForTags(metadata.tags).map((
            it,
          ) => [it.defaultThreatRadius, it.defaultWarningRadius]).reduce(
            (a, b) => [a[0] || b[0], a[1] || b[1]],
            [undefined, undefined],
          );
          if (profile[0] || profile[1]) {
            const current = obj.get(entityId);
            obj = obj.set(entityId, {
              ...current,
              profileThreatRadius: profile[0],
              profileWarningRadius: profile[1],
            });
          }
        }
      }),
    };
  });
}, 1000);
