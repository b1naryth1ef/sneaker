import Immutable from "immutable";
import {
  EntityMetadata,
  entityMetadataStore,
} from "./stores/EntityMetadataStore";
import { Geometry, geometryStore } from "./stores/GeometryStore";
import { hackStore } from "./stores/HackStore";
import { serverStore } from "./stores/ServerStore";
import { TrackOptions, trackStore } from "./stores/TrackStore";

export type SavedDataV1 = {
  version: 0;
  sessionId: string;
  hacks: Array<number>;
  entityMetadata: Array<[number, { labels: Array<string> }]>;
  trackOptions: Array<[number, TrackOptions]>;
  geometry: Array<Geometry>;
};

export type SavedData = SavedDataV1;

export function saveData() {
  const serverState = serverStore.getState();
  if (serverState.sessionId === null || !serverState.server) {
    return;
  }

  // Save hacks
  const hackState = hackStore.getState();

  const data: SavedDataV1 = {
    version: 0,
    sessionId: serverState.sessionId,
    hacks: hackState.hacks.toArray(),
    entityMetadata: entityMetadataStore.getState().entities.entrySeq()
      .toJS() as any,
    trackOptions: trackStore.getState().trackOptions.entrySeq().toJS() as any,
    geometry: geometryStore.getState().geometry.valueSeq().toJS() as any,
  };

  localStorage.setItem(
    `saved-data-${serverState.server.name}`,
    JSON.stringify(data),
  );
}

export function restoreData(serverName: string, sessionId: string): boolean {
  const data = localStorage.getItem(`saved-data-${serverName}`);
  if (!data) {
    console.log(`[DataSaver] no saved data`);
    return false;
  }

  const payloadRaw = JSON.parse(data) as Partial<SavedData>;
  if (payloadRaw.version === 0) {
    if (payloadRaw.sessionId !== sessionId) {
      console.log(`[DataSaver] outdated session id, not restoring`);
      return false;
    }

    hackStore.setState({
      hacks: Immutable.Set<number>(payloadRaw.hacks!),
    });
    entityMetadataStore.setState({
      entities: Immutable.Map<number, EntityMetadata>(
        payloadRaw.entityMetadata!.map(([entityId, data]) => {
          return [entityId, {
            labels: Immutable.Set<string>(data.labels),
          }];
        }),
      ),
    });
    trackStore.setState({
      trackOptions: Immutable.Map<number, TrackOptions>(
        payloadRaw.trackOptions!,
      ),
    });

    if (payloadRaw.geometry && payloadRaw.geometry.length > 0) {
      const maxId = Math.max(...payloadRaw.geometry.map((it) => it.id)) + 1;
      geometryStore.setState({
        geometry: Immutable.Map<number, Geometry>(
          payloadRaw.geometry.map((it) => [it.id, it]),
        ),
        id: maxId,
      });
    }
    console.log(`[DataSaver] restored data for session ${sessionId}`);
    return true;
  } else {
    console.log(`[DataSaver] unsupported data version: ${payloadRaw.version}`);
    return false;
  }
}

serverStore.subscribe(
  (
    [name, sessionId]: [string | null, string | null],
    [_, lastSessionId]: [string | null, string | null],
  ) => {
    if (name && sessionId && !lastSessionId) {
      restoreData(name, sessionId);
    }
  },
  (state) =>
    [state.server?.name || null, state.sessionId] as [
      string | null,
      string | null,
    ],
);

export function dataSaverLoop() {
  try {
    saveData();
  } finally {
    setTimeout(dataSaverLoop, 1500);
  }
}
