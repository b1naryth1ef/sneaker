import Immutable from "immutable";
import create from "zustand";
import { serverStore } from "./ServerStore";

type HackStoreData = {
  hacks: Immutable.Set<number>;
};
export const hackStore = create<HackStoreData>(() => {
  return { hacks: Immutable.Set<number>() };
});

export function pushHack(start?: number): number {
  const startAt = start || serverStore.getState().offset;

  hackStore.setState((state) => {
    return { hacks: state.hacks.add(startAt) };
  });
  return startAt;
}

export function popHack(hackTime: number) {
  hackStore.setState((state) => {
    return { hacks: state.hacks.remove(hackTime) };
  });
}
