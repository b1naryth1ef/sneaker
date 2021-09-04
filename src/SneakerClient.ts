import { RawEntityData } from "./types/entity";

export type SneakerRadarSnapshotEvent = {
  e: "SESSION_RADAR_SNAPSHOT";
  d: {
    offset: number;
    created: Array<RawEntityData>;
    updated: Array<RawEntityData>;
    deleted: Array<number>;
  };
};

export type SneakerInitialStateEvent = {
  e: "SESSION_STATE";
  d: {
    session_id: string;
    offset: number;
    objects?: Array<RawEntityData>;
  };
};

export type SneakerSessionEvent =
  | SneakerRadarSnapshotEvent
  | SneakerInitialStateEvent;

export class SneakerClient {
  private url: string;
  private eventSource: EventSource | null;

  constructor(url: string) {
    this.url = url;
    this.eventSource = null;
  }

  close() {
    this.eventSource?.close();
  }

  run(onEvent: (event: SneakerSessionEvent) => void) {
    this.eventSource = new EventSource(this.url);
    this.eventSource.onmessage = (event) => {
      const sneakerEvent = JSON.parse(event.data) as SneakerSessionEvent;
      onEvent(sneakerEvent);
    };
    this.eventSource.onerror = () => {
      // TODO: we can back-off here, but for now we delay 5 seconds
      console.error(
        "[SneakerClient] event source error, reopening in 5 seconds",
      );
      setTimeout(() => this.run(onEvent), 5000);
    };
  }
}
