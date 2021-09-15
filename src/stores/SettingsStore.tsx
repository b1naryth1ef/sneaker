import create from "zustand";

export enum GroundUnitMode {
  FRIENDLY = "friendly",
  ENEMY = "enemy",
}

export type SettingsStoreData = {
  map: {
    showTrackIcons?: boolean;
    showTrackLabels?: boolean;
    groundUnitMode?: GroundUnitMode;
  };
};

export const settingsStore = create<SettingsStoreData>(() => {
  const localData = localStorage.getItem("settings");
  if (localData) {
    return JSON.parse(localData) as SettingsStoreData;
  }
  return {
    map: {
      showTrackIcons: true,
      showTrackLabels: true,
      groundUnitMode: GroundUnitMode.FRIENDLY,
    },
  };
});

settingsStore.subscribe((state) => {
  localStorage.setItem("settings", JSON.stringify(state));
});
