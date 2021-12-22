import Immutable from "immutable";
import create from "zustand";
import { getProfilesForTags } from "./ProfileStore";
import { setTrackOptions } from "./TrackStore";

export type EntityMetadata = {
  tags: Immutable.Set<string>;
};

type EntityMetadataStoreData = {
  entities: Immutable.Map<number, EntityMetadata>;
};
export const entityMetadataStore = create<EntityMetadataStoreData>(() => {
  return { entities: Immutable.Map<number, EntityMetadata>() };
});

export function useEntityMetadata(
  entityId: number
): EntityMetadata | undefined {
  return entityMetadataStore((state) => state.entities.get(entityId));
}

export function pushEntityTag(entityId: number, tag: string) {
  return entityMetadataStore.setState((state) => {
    const existing = state.entities.get(entityId);
    const tags = existing ? existing.tags.add(tag) : Immutable.Set.of(tag);

    const profiles = getProfilesForTags(tags)
      .map((it) => [it.defaultThreatRadius, it.defaultWarningRadius])
      .reduce((a, b) => [a[0] || b[0], a[1] || b[1]], [undefined, undefined]);

    setTrackOptions(entityId, {
      profileThreatRadius: profiles[0],
      profileWarningRadius: profiles[1],
    });

    if (!existing) {
      return {
        entities: state.entities.set(entityId, {
          tags,
        }),
      };
    } else if (!existing.tags.includes(tag)) {
      return {
        entities: state.entities.set(entityId, {
          ...existing,
          tags,
        }),
      };
    }
  });
}

export function popEntityTag(entityId: number, label: string) {
  return entityMetadataStore.setState((state) => {
    const existing = state.entities.get(entityId);
    if (!existing) {
      return state;
    } else {
      const tags = existing.tags.remove(label);
      const profiles = getProfilesForTags(tags)
        .map((it) => [it.defaultThreatRadius, it.defaultWarningRadius])
        .reduce((a, b) => [a[0] || b[0], a[1] || b[1]], [undefined, undefined]);

      setTrackOptions(entityId, {
        profileThreatRadius: profiles[0],
        profileWarningRadius: profiles[1],
      });

      return {
        entities: state.entities.set(entityId, {
          ...existing,
          tags,
        }),
      };
    }
  });
}
