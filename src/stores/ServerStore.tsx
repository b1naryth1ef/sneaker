import Immutable from "immutable";
import create from "zustand";
import { planes } from "../dcs/aircraft";

type Event = {
  e: "CREATE";
  o: Array<RawObjectData>;
} | { e: "DELETE"; id: Array<number> };

type RawObjectData = {
  id: number;
  types: Array<string>;
  properties: Record<string, unknown>;
  longitude: number;
  latitude: number;
  altitude: number;
  heading: number;
};

export class ObjectMetadata {
  id: number;
  types: Array<string>;
  properties: Record<string, unknown>;
  longitude: number;
  latitude: number;
  altitude: number;
  heading: number;

  constructor(data: RawObjectData) {
    this.id = data.id;
    this.types = data.types;
    this.properties = data.properties;
    this.longitude = data.longitude;
    this.latitude = data.latitude;
    this.altitude = data.altitude;
    this.heading = data.heading;
  }

  get coalition(): string {
    return this.properties["Coalition"] as string;
  }

  get name(): string {
    return this.properties["Name"] as string;
  }

  get pilot(): string {
    return this.properties["Pilot"] as string;
  }

  get group(): string {
    return this.properties["Group"] as string;
  }
}

export function generateSIDC(target: ObjectMetadata): string {
  const ident = target.coalition === "Allies" ? "H" : "F";
  if (target.types.includes("Bullseye")) {
    return `G${ident}G-GPWA--`;
  }

  let battleDimension = "z";
  if (target.types.includes("Air")) {
    battleDimension = "a";
  } else if (target.types.includes("Sea")) {
    battleDimension = "s";
  } else if (target.types.includes("Ground")) {
    battleDimension = "g";
  }

  const plane = planes[target.name];
  if (plane !== undefined) {
    return `S${ident}${battleDimension}-${plane.sidcPlatform}--`;
  } else if (target.types.includes("Air")) {
    console.log(
      `Missing AIR SIDC platform definition: ${target.name} (${
        target.types.join(", ")
      })`,
    );
  }

  return `S${ident}${battleDimension}-------`;
}

export type ServerStoreData = {
  objects: Immutable.Map<number, ObjectMetadata>;
};

export const serverStore = create<ServerStoreData>(() => {
  // Start the poller looping
  // setTimeout(pollServerData, 500);
  setTimeout(doLongPoll, 500);

  return {
    objects: Immutable.Map<number, ObjectMetadata>(),
  };
});

function doLongPoll() {
  // TODO: retry / restart on error

  const eventSource = new EventSource("http://localhost:7788");
  eventSource.onmessage = (event) => {
    const eventData = JSON.parse(event.data) as Event;
    serverStore.setState((state) => {
      let objects = state.objects;
      if (eventData.e === "CREATE") {
        for (const obj of eventData.o) {
          objects = objects.set(obj.id, new ObjectMetadata(obj));
        }
      } else if (eventData.e === "DELETE") {
        for (const objId of eventData.id) {
          objects = objects.remove(objId);
        }
      }
      return { ...state, objects };
    });
  };
  eventSource.onerror = () => {
    // TODO: we can back-off here, but for now we delay 5 seconds
    console.log("Error in event source, attempting to reopen shortly...");
    setTimeout(doLongPoll, 5000);
    serverStore.setState({
      objects: Immutable.Map<number, ObjectMetadata>(),
    });
  };
}
