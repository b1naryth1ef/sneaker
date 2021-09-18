import Immutable from "immutable";
import { throttle } from "lodash";
import create from "zustand";
import { Entity } from "../types/entity";
import { EntityMetadata, entityMetadataStore } from "./EntityMetadataStore";
import { trackStore } from "./TrackStore";

export type TrackFieldAltitude = {
  type: "altitude";
  unit: "feet" | "meters";
  minPlaces: number;
  decimalPlaces: number;
};

export type TrackFieldGroundSpeed = {
  type: "ground-speed";
  unit: "knots" | "mach" | "kph";
};

export type TrackFieldVerticalSpeed = {
  type: "vertical-speed";
  unit: "fpm" | "kpm" | "visual";
}

export type TrackField = (TrackFieldAltitude | TrackFieldGroundSpeed | TrackFieldVerticalSpeed) & {
  color?: string;
};

export type ProfileSelectorTag = {
  type: "tag";
  value: string;
};

export type ProfileSelectorType = {
  type: "type";
  value: string;
};

export type ProfileSelectorName = {
  type: "name";
  value: string;
};

export type ProfileSelectorCoalition = {
  type: "coalition";
  value: "Enemies" | "Allies";
};

export type ProfileSelector =
  | ProfileSelectorTag
  | ProfileSelectorType
  | ProfileSelectorCoalition
  | ProfileSelectorName;

export type Profile = {
  name: string;
  tags: Array<string>;
  defaultThreatRadius?: number;
  defaultWarningRadius?: number;

  // The format of track labels
  trackLabelFormat?: string;
  trackFields?: Array<TrackField>;

  // TODO: move from tags to selectors
  selectors: Array<ProfileSelector>;
};

type ProfileStoreData = {
  profiles: Immutable.Map<string, Profile>;
};
export const profileStore = create<ProfileStoreData>(() => {
  let profiles = Immutable.Map<string, Profile>();

  const profilesRaw = localStorage.getItem("profiles");
  if (profilesRaw) {
    profiles = Immutable.Map<string, Profile>(JSON.parse(profilesRaw));
  }
  return { profiles };
});

export function getProfileForEntity(
  entity: Entity,
  metadata?: EntityMetadata,
): Profile | null {
  // TODO: for now this will just use getProfilesForTags, eventually we want to
  //  utilize selectors.
  return null;
}

export function getProfilesForTags(
  tags: Immutable.Set<string>,
  profiles?: Immutable.Map<string, Profile>,
): Array<Profile> {
  return (profiles || profileStore.getState().profiles).valueSeq().filter((
    it,
  ) => tags.intersect(it.tags).size > 0).sort((a, b) =>
    a.name > b.name ? -1 : 1
  ).toArray();
}

export function addProfile(name: string) {
  return profileStore.setState((state) => {
    if (state.profiles.has(name)) return;
    return {
      profiles: state.profiles.set(name, { name, tags: [], selectors: [] }),
    };
  });
}

export function deleteProfile(name: string) {
  return profileStore.setState((state) => {
    if (!state.profiles.has(name)) return;
    const profiles = state.profiles.remove(name);

    trackStore.setState((state) => {
      let trackOptions = state.trackOptions;
      for (
        const [entityId, metadata] of entityMetadataStore.getState().entities
      ) {
        const profile = getProfilesForTags(metadata.tags, profiles).map((
          it,
        ) => [it.defaultThreatRadius, it.defaultWarningRadius]).reduce(
          (a, b) => [a[0] || b[0], a[1] || b[1]],
          [undefined, undefined],
        );

        const opts = trackOptions.get(entityId) || {};
        trackOptions = trackOptions.set(entityId, {
          ...opts,
          profileThreatRadius: profile[0],
          profileWarningRadius: profile[1],
        });
      }
      return { ...state, trackOptions };
    });

    return { profiles };
  });
}

export function updateProfile(profile: { name: string } & Partial<Profile>) {
  return profileStore.setState((state) => {
    const existing = state.profiles.get(profile.name);
    if (!existing) return;

    const profiles = state.profiles.set(profile.name, {
      ...existing,
      ...profile,
    });

    trackStore.setState((state) => {
      let trackOptions = state.trackOptions;
      for (
        const [entityId, metadata] of entityMetadataStore.getState().entities
      ) {
        const profile = getProfilesForTags(metadata.tags, profiles).map((
          it,
        ) => [it.defaultThreatRadius, it.defaultWarningRadius]).reduce(
          (a, b) => [a[0] || b[0], a[1] || b[1]],
          [undefined, undefined],
        );

        const opts = trackOptions.get(entityId) || {};
        trackOptions = trackOptions.set(entityId, {
          ...opts,
          profileThreatRadius: profile[0],
          profileWarningRadius: profile[1],
        });
      }
      return { ...state, trackOptions };
    });

    return {
      profiles,
    };
  });
}

profileStore.subscribe(
  throttle((profiles: ProfileStoreData["profiles"]) => {
    localStorage.setItem(
      "profiles",
      JSON.stringify(profiles.toJSON()),
    );
  }, 100),
  (state) => state.profiles,
);
