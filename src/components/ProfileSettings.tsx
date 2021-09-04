import React, { useState } from "react";
import { BiX } from "react-icons/bi";
import {
  addProfile,
  deleteProfile,
  Profile,
  profileStore,
  updateProfile,
} from "../stores/ProfileStore";

function ProfileLabels({ profile }: { profile: Profile }): JSX.Element {
  const [addLabelText, setAddLabelText] = useState("");

  return (
    <div>
      <div className="flex flex-col">
        <div className="flex flex-row flex-grow items-center">
          <label className="flex-grow">
            <span className="text-gray-700">Labels</span>
            <div className="flex flex-row">
              <input
                className="form-input mt-1 block w-full p-1 flex-grow"
                value={addLabelText}
                onChange={(e) => setAddLabelText(e.target.value)}
              />

              <button
                onClick={() => {
                  if (addLabelText === "") return;
                  updateProfile({
                    name: profile.name,
                    labels: [...profile.labels, addLabelText],
                  });
                  setAddLabelText("");
                }}
                className="bg-green-100 border-green-300 border ml-2 p-1"
              >
                Add
              </button>
            </div>
          </label>
        </div>
        <div className="flex flex-row gap-2 pt-2">
          {profile.labels.map((label) => (
            <div
              className="p-1 bg-blue-200 hover:bg-blue-300 border-blue-400 border rounded-sm flex flex-row items-center"
              key={label}
            >
              <div>{label}</div>
              <button
                onClick={() =>
                  updateProfile({
                    name: profile.name,
                    labels: profile.labels.filter((lbl) => lbl !== label),
                  })}
                className="text-red-500"
              >
                <BiX className="inline-flex h-5 w-5 ml-1" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: Profile }) {
  return (
    <div
      className="border-b border-gray-300 text-sm flex flex-col gap-1 py-1 my-2"
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
        <ProfileLabels profile={profile} />
      </div>
    </div>
  );
}

export function ProfileSettings(): JSX.Element {
  const [newProfileName, setNewProfileName] = useState("");
  const profiles = profileStore((state) => state.profiles);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center pb-2 border-b border-gray-300">
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
            }}
            className="flex-grow inline-block ml-auto p-1 bg-green-100 border-green-300 border rounded-sm shadow-sm text-xs"
          >
            Create
          </button>
        </div>
      </div>
      <div className="flex flex-grow flex-col">
        {profiles.valueSeq().map((
          it,
        ) => <ProfileDetails profile={it} key={it.name} />)}
      </div>
    </div>
  );
}
