import Immutable from "immutable";
import create from "zustand";
import { SneakerClient } from "../SneakerClient";
import { Entity } from "../types/entity";
import { route } from "../util";
import { createTracks, updateTracks } from "./TrackStore";

export type Server = {
  name: string;
};

// const worker = new Worker(new URL("../worker.ts", import.meta.url));
// worker.onmessage = (event) => {
//   console.log(event);
// };

export type ServerStoreData = {
  server: Server | null;
  entities: Immutable.Map<number, Entity>;
  offset: number;
  sessionId: string | null;
};

export const serverStore = create<ServerStoreData>(() => {
  return {
    server: null,
    entities: Immutable.Map<number, Entity>(),
    offset: 0,
    sessionId: null,
  };
});

(window as any).serverStore = serverStore;

let sneakerClient: SneakerClient | null = null;

function runSneakerClient(server: Server | null) {
  sneakerClient?.close();

  if (server !== null) {
    setTimeout(() => {
      sneakerClient = new SneakerClient(
        route(`/servers/${server.name}/events`),
      );
      sneakerClient?.run((event) => {
        if (event.e === "SESSION_STATE") {
          serverStore.setState((state) => {
            return {
              ...state,
              sessionId: event.d.session_id,
              entities: Immutable.Map<number, Entity>(
                event.d.objects?.map((obj) => [obj.id, new Entity(obj)]) || [],
              ),
            };
          });
          createTracks(event);
        } else if (event.e === "SESSION_RADAR_SNAPSHOT") {
          serverStore.setState((state) => {
            return {
              ...state,
              offset: event.d.offset,
              entities: state.entities.withMutations((obj) => {
                for (const object of event.d.created) {
                  obj = obj.set(object.id, new Entity(object));
                }
                for (const object of event.d.updated) {
                  obj = obj.set(object.id, new Entity(object));
                }
                for (const objectId of event.d.deleted) {
                  obj = obj.remove(objectId);
                }
              }),
            };
          });
          updateTracks(event);
        }
      });
    });
  } else {
    serverStore.setState({
      entities: Immutable.Map<number, Entity>(),
      offset: 0,
    });
  }
}

serverStore.subscribe(runSneakerClient, (state) => state.server);
