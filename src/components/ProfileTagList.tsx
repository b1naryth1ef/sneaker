import React, { useState } from "react";
import { BiX } from "react-icons/bi";
import { Profile, updateProfile } from "../stores/ProfileStore";

export default function ProfileTagList(
  { profile }: { profile: Profile },
): JSX.Element {
  const [addTagText, setAddTagText] = useState("");

  return (
    <div>
      <div className="flex flex-col">
        <div className="flex flex-row flex-grow items-center">
          <label className="flex-grow">
            <span className="text-gray-700">Tags</span>
            <div className="flex flex-row">
              <input
                className="form-input mt-1 block w-full p-1 flex-grow"
                value={addTagText}
                onChange={(e) => setAddTagText(e.target.value)}
              />

              <button
                onClick={() => {
                  if (addTagText === "") return;
                  updateProfile({
                    name: profile.name,
                    tags: [...profile.tags, addTagText],
                  });
                  setAddTagText("");
                }}
                className="bg-green-100 border-green-300 border ml-2 p-1"
              >
                Add
              </button>
            </div>
          </label>
        </div>
        <div className="flex flex-row gap-2 pt-2">
          {profile.tags.map((tag) => (
            <div
              className="p-1 bg-blue-200 hover:bg-blue-300 border-blue-400 border rounded-sm flex flex-row items-center"
              key={tag}
            >
              <div>{tag}</div>
              <button
                onClick={() =>
                  updateProfile({
                    name: profile.name,
                    tags: profile.tags.filter((it) => it !== tag),
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
