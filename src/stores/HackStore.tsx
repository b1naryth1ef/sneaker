import Immutable from "immutable";
import create from "zustand";
import { serverStore } from "./ServerStore";

type HackStoreData = {
  hacks: Immutable.Set<number>;
};
export const hackStore = create<HackStoreData>(() => {
  const hacksRaw = localStorage.getItem("hacks");
  if (hacksRaw) {
    return {
      hacks: Immutable.Set<number>(
        (JSON.parse(hacksRaw) as Array<string>).map((it) => parseInt(it)),
      ),
    };
  }

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

hackStore.subscribe((hacks: HackStoreData["hacks"]) => {
  localStorage.setItem(
    "hacks",
    JSON.stringify(hacks.toJSON()),
  );
}, (state) => state.hacks);
