import Immutable from "immutable";
import create from "zustand";
import { Entity, RawEntityData } from "../types/entity";
import { deleteTracks, updateTracks } from "./TrackStore";

type Event =
  & {
    t: number;
  }
  & (
    | {
      e: "CREATE_ENTITIES";
      o: Array<RawEntityData>;
    }
    | { e: "DELETE_ENTITIES"; id: Array<number> }
  );

export type ServerStoreData = {
  entities: Immutable.Map<number, Entity>;
  offset: number;
};

export const serverStore = create<ServerStoreData>(() => {
  // Start our long-poller
  setTimeout(doLongPoll, 500);

  return {
    entities: Immutable.Map<number, Entity>(),
    offset: 0,
  };
});

(window as any).serverStore = serverStore;

function doLongPoll() {
  // TODO: retry / restart on error
  const eventSource = new EventSource(
    process.env.NODE_ENV === "production"
      ? "/events"
      : "http://localhost:7789/events",
  );
  eventSource.onmessage = (event) => {
    const eventData = JSON.parse(event.data) as Event;
    serverStore.setState((state) => {
      return {
        ...state,
        offset: eventData.t,
        entities: state.entities.withMutations((entities) => {
          if (eventData.e === "CREATE_ENTITIES" && eventData.o) {
            for (const obj of eventData.o) {
              entities = entities.set(obj.id, new Entity(obj));
            }

            updateTracks(eventData.o);
          } else if (eventData.e === "DELETE_ENTITIES" && eventData.id) {
            deleteTracks(eventData.id);
            for (const objId of eventData.id) {
              entities = entities.remove(objId);
            }
          }
        }),
      };
    });
  };
  eventSource.onerror = () => {
    // TODO: we can back-off here, but for now we delay 5 seconds
    console.error("Error in event source, attempting to reopen shortly...");
    setTimeout(doLongPoll, 5000);
    serverStore.setState({
      entities: Immutable.Map<number, Entity>(),
    });
  };
}

export function forceDeleteEntity(entityId: number) {
  deleteTracks([entityId]);
  serverStore.setState((state) => {
    return {
      ...state,
      entities: state.entities.remove(entityId),
    };
  });
}
