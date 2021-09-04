import Immutable from "immutable";
import create from "zustand";
import { getProfilesForLabels } from "./ProfileStore";
import { setTrackOptions } from "./TrackStore";

export type EntityMetadata = {
  labels: Immutable.Set<string>;
};

type EntityMetadataStoreData = {
  entities: Immutable.Map<number, EntityMetadata>;
};
export const entityMetadataStore = create<EntityMetadataStoreData>(() => {
  return { entities: Immutable.Map<number, EntityMetadata>() };
});

export function useEntityMetadata(
  entityId: number,
): EntityMetadata | undefined {
  return entityMetadataStore((state) => state.entities.get(entityId));
}

export function pushEntityLabel(entityId: number, label: string) {
  return entityMetadataStore.setState((state) => {
    const existing = state.entities.get(entityId);
    const labels = existing
      ? existing.labels.add(label)
      : Immutable.Set.of(label);

    const profiles = getProfilesForLabels(labels).map((
      it,
    ) => [it.defaultThreatRadius, it.defaultWarningRadius]).reduce(
      (a, b) => [a[0] || b[0], a[1] || b[1]],
      [undefined, undefined],
    );

    setTrackOptions(entityId, {
      profileThreatRadius: profiles[0],
      profileWarningRadius: profiles[1],
    });

    if (!existing) {
      return {
        entities: state.entities.set(entityId, {
          labels: labels,
        }),
      };
    } else if (!existing.labels.includes(label)) {
      return {
        entities: state.entities.set(entityId, {
          ...existing,
          labels: labels,
        }),
      };
    }
  });
}

export function popEntityLabel(entityId: number, label: string) {
  return entityMetadataStore.setState((state) => {
    const existing = state.entities.get(entityId);
    if (!existing) {
      return state;
    } else {
      const labels = existing.labels.remove(label);
      const profiles = getProfilesForLabels(labels).map((
        it,
      ) => [it.defaultThreatRadius, it.defaultWarningRadius]).reduce(
        (a, b) => [a[0] || b[0], a[1] || b[1]],
        [undefined, undefined],
      );

      setTrackOptions(entityId, {
        profileThreatRadius: profiles[0],
        profileWarningRadius: profiles[1],
      });

      return {
        entities: state.entities.set(entityId, {
          ...existing,
          labels: labels,
        }),
      };
    }
  });
}
