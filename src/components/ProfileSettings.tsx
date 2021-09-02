import React, { useState } from "react";
import { BiX } from "react-icons/bi";
import {
  addProfile,
  Profile,
  profileStore,
  updateProfile,
} from "../stores/ProfileStore";

function ProfileLabels({ profile }: { profile: Profile }): JSX.Element {
  const [addLabelText, setAddLabelText] = useState("");

  return (
    <div>
      <div className="flex flex-col p-2">
        <div className="flex flex-row flex-grow items-center">
          <input
            className="w-full border-blue-200 border rounded-sm"
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
        <div className="flex flex-row gap-2">
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

export function ProfileSettings(): JSX.Element {
  const [newProfileName, setNewProfileName] = useState("");
  const profiles = profileStore((state) => state.profiles);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row gap-2 items-center">
        <div className="flex-grow">
          <input
            className="form-input m-1 block w-full h-full"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />
        </div>
        <button
          disabled={newProfileName === ""}
          onClick={() => {
            addProfile(newProfileName);
          }}
          className="ml-auto p-1 bg-green-100 border-green-300 border rounded-sm shadow-sm text-xs"
        >
          Add
        </button>
      </div>
      <div className="flex flex-grow flex-col">
        {profiles.valueSeq().map((
          it,
        ) => (
          <div
            className="border-b border-gray-400 text-sm flex flex-col gap-1 pb-1"
          >
            <div className="flex flex-row">
              <b className="flex-grow">
                Name:
              </b>{" "}
              {it.name}
            </div>
            <div className="flex flex-row">
              <b className="flex-grow">
                Default TR
              </b>
              <input
                className="w-16"
                value={it.defaultThreatRadius || ""}
                onChange={(e) => {
                  updateProfile({
                    name: it.name,
                    defaultThreatRadius: e.target.value !== ""
                      ? parseInt(e.target.value)
                      : undefined,
                  });
                }}
              />
            </div>
            <div className="flex flex-row">
              <b className="flex-grow">
                Default WR
              </b>
              <input
                className="w-16"
                value={it.defaultWarningRadius || ""}
                onChange={(e) => {
                  updateProfile({
                    name: it.name,
                    defaultWarningRadius: e.target.value !== ""
                      ? parseInt(e.target.value)
                      : undefined,
                  });
                }}
              />
            </div>
            <ProfileLabels profile={it} />
          </div>
        ))}
      </div>
    </div>
  );
}
