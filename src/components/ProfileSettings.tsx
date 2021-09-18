import React, { useState } from "react";
import {
  addProfile,
  deleteProfile,
  Profile,
  profileStore,
  updateProfile,
} from "../stores/ProfileStore";
import ProfileTagList from "./ProfileTagList";

function ProfileDetails({ profile }: { profile: Profile }) {
  return (
    <div
      className="border bg-gray-100 border-gray-300 text-sm flex flex-col gap-1 p-2 rounded-sm"
    >
      <div className="flex flex-row mb-1">
        <div className="flex-grow text-xl">{profile.name}</div>
        <div>
          <button
            onClick={() => {
              if (confirm(`Delete profile ${profile.name}?`)) {
                deleteProfile(profile.name);
              }
            }}
            className="inline-block p-1 bg-red-100 border-red-300 border rounded-sm shadow-sm text-xs"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="flex flex-col">
        <label className="col-span-1">
          <span className="text-gray-700">Default Threat Radius</span>
          <input
            className="form-input mt-1 block w-full p-1"
            value={profile.defaultThreatRadius || ""}
            onChange={(e) => {
              updateProfile({
                name: profile.name,
                defaultThreatRadius: e.target.value !== ""
                  ? parseInt(e.target.value)
                  : undefined,
              });
            }}
          />
        </label>
        <label className="col-span-1">
          <span className="text-gray-700">Default Warning Radius</span>
          <input
            className="form-input mt-1 block w-full p-1"
            value={profile.defaultWarningRadius || ""}
            onChange={(e) => {
              updateProfile({
                name: profile.name,
                defaultWarningRadius: e.target.value !== ""
                  ? parseInt(e.target.value)
                  : undefined,
              });
            }}
          />
        </label>
        <ProfileTagList profile={profile} />
      </div>
    </div>
  );
}

export function ProfileSettings(): JSX.Element {
  const [newProfileName, setNewProfileName] = useState("");
  const profiles = profileStore((state) => state.profiles);

  return (
    <div className="flex flex-col">
      <div
        className="flex flex-row items-center pb-2 border-b border-gray-300 mb-4"
      >
        <div className="flex-grow">
          <h3 className="text-xl">Profiles</h3>
        </div>
        <div className="flex flex-row gap-2 items-center">
          <input
            className="form-input block w-full h-full p-1 border border-gray-200"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profile name"
          />
          <button
            disabled={newProfileName === ""}
            onClick={() => {
              addProfile(newProfileName);
              setNewProfileName("");
            }}
            className="flex-grow inline-block ml-auto p-1 bg-green-100 border-green-300 border rounded-sm shadow-sm text-xs"
          >
            Create
          </button>
        </div>
      </div>
      <div className="flex flex-grow flex-col gap-2">
        {profiles.valueSeq().map((
          it,
        ) => <ProfileDetails profile={it} key={it.name} />)}
      </div>
    </div>
  );
}
