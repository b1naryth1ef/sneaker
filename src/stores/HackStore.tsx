import Immutable from "immutable";
import create from "zustand";

type HackStoreData = {
  hacks: Immutable.Set<number>;
};
export const hackStore = create<HackStoreData>(() => {
  return { hacks: Immutable.Set<number>() };
});

export function pushHack(): number {
  const startAt = (new Date()).getTime();
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
