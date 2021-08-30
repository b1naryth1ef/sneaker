import Immutable from "immutable";
import create from "zustand";
import { Entity, RawEntityData } from "../types/entity";
import { deleteTracks, updateTracks } from "./TrackStore";

type Event = {
  e: "CREATE";
  o: Array<RawEntityData>;
} | { e: "DELETE"; id: Array<number> };

export type ServerStoreData = {
  entities: Immutable.Map<number, Entity>;
};

export const serverStore = create<ServerStoreData>(() => {
  // Start our long-poller
  setTimeout(doLongPoll, 500);

  return {
    entities: Immutable.Map<number, Entity>(),
  };
});

function doLongPoll() {
  // TODO: retry / restart on error
  const eventSource = new EventSource("http://eos.hydr0.com:7789/events");
  eventSource.onmessage = (event) => {
    const eventData = JSON.parse(event.data) as Event;
    serverStore.setState((state) => {
      return {
        ...state,
        entities: state.entities.withMutations((entities) => {
          if (eventData.e === "CREATE") {
            for (const obj of eventData.o) {
              entities = entities.set(obj.id, new Entity(obj));
            }

            updateTracks(eventData.o);
          } else if (eventData.e === "DELETE") {
            for (const objId of eventData.id) {
              entities = entities.remove(objId);
            }

            deleteTracks(eventData.id);
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
