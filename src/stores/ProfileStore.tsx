import Immutable from "immutable";
import { throttle } from "lodash";
import create from "zustand";

export type Profile = {
  name: string;
  labels: Array<string>;
  defaultThreatRadius?: number;
  defaultWarningRadius?: number;
};

type ProfileStoreData = {
  profiles: Immutable.Map<string, Profile>;
};
export const profileStore = create<ProfileStoreData>(() => {
  let profiles = Immutable.Map<string, Profile>();

  const profilesRaw = localStorage.getItem("profiles");
  if (profilesRaw) {
    profiles = Immutable.Map<string, Profile>(JSON.parse(profilesRaw));
  }
  return { profiles };
});

export function addProfile(name: string) {
  return profileStore.setState((state) => {
    if (state.profiles.has(name)) return;
    return { profiles: state.profiles.set(name, { name, labels: [] }) };
  });
}

export function updateProfile(profile: { name: string } & Partial<Profile>) {
  return profileStore.setState((state) => {
    const existing = state.profiles.get(profile.name);
    if (!existing) return;
    return {
      profiles: state.profiles.set(profile.name, {
        ...existing,
        ...profile,
      }),
    };
  });
}

profileStore.subscribe(
  throttle((profiles: ProfileStoreData["profiles"]) => {
    localStorage.setItem(
      "profiles",
      JSON.stringify(profiles.toJSON()),
    );
  }, 100),
  (state) => state.profiles,
);
