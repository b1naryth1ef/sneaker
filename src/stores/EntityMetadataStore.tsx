import Immutable from "immutable";
import create from "zustand";

export type EntityMetadata = {
  labels: Immutable.Set<string>;
};

type EntityMetadataStoreData = {
  entities: Immutable.Map<number, EntityMetadata>;
};
export const entityMetadataStore = create<EntityMetadataStoreData>(() => {
  let entities = Immutable.Map<number, EntityMetadata>();

  const entityMetadataRaw = localStorage.getItem("entity-metadata");
  if (entityMetadataRaw) {
    entities = entities.withMutations((obj) => {
      for (
        const [key, value] of Object.entries(JSON.parse(entityMetadataRaw))
      ) {
        let uValue = value as EntityMetadata;
        uValue.labels = Immutable.Set<string>(uValue.labels);
        obj = obj.set(parseInt(key), uValue);
      }
    });
  }

  return { entities };
});

export function useEntityMetadata(
  entityId: number,
): EntityMetadata | undefined {
  return entityMetadataStore((state) => state.entities.get(entityId));
}

export function pushEntityLabel(entityId: number, label: string) {
  return entityMetadataStore.setState((state) => {
    const existing = state.entities.get(entityId);

    // const opts = trackStore.getState().trackOptions.get(entityId) || {};
    // const profiles = profileStore.getState().profiles.filter((it) =>
    //   it.labels.includes(label)
    // ).map((it) => [it.defaultThreatRadius, it.defaultWarningRadius]).reduce((
    //   a: any,
    //   b: any,
    // ) => [
    //   a[0] || b[0],
    //   a[1] || b[1],
    // ], [undefined, undefined]);

    // let update: TrackOptions = {};
    // if (!opts.threatRadius && profiles[0]) {
    //   update.threatRadius = profiles[0];
    // }
    // if (!opts.warningRadius && profiles[1]) {
    //   update.warningRadius = profiles[1];
    // }
    // if (update.warningRadius || update.threatRadius) {
    //   setTrackOptions(entityId, update);
    // }

    if (!existing) {
      return {
        entities: state.entities.set(entityId, {
          labels: Immutable.Set.of(label),
        }),
      };
    } else if (!existing.labels.includes(label)) {
      return {
        entities: state.entities.set(entityId, {
          ...existing,
          labels: existing.labels.add(label),
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
      return {
        entities: state.entities.set(entityId, {
          ...existing,
          labels: existing.labels.filter((it) => it !== label),
        }),
      };
    }
  });
}

entityMetadataStore.subscribe(
  (entities: EntityMetadataStoreData["entities"]) => {
    localStorage.setItem(
      "entity-metadata",
      JSON.stringify(entities.toJSON()),
    );
  },
  (state) => state.entities,
);
