import classNames from "classnames";
import React, { useState } from "react";
import { BiX } from "react-icons/bi";
import { ProfileSettings } from "./ProfileSettings";

export function Settings({ close }: { close: () => void }): JSX.Element {
  const [tab, setTab] = useState<"map" | "profiles">("map");

  return (
    <div
      className={classNames(
        "flex flex-col overflow-x-hidden overflow-y-auto absolute",
        "inset-0 z-50 bg-gray-100 mx-auto my-auto max-h-96 max-w-3xl",
        "border border-gray-200 rounded-sm shadow-md",
      )}
    >
      <div className="flex flex-row items-center p-2 border-b border-gray-400">
        <div className="text-2xl">Settings</div>
        <button
          className="ml-auto flex flex-row items-center"
          onClick={() => close()}
        >
          <BiX className="inline-block w-6 h-6 text-red-500" />
        </button>
      </div>
      <div className="flex flex-row p-2 h-full">
        <div
          className="flex-none flex flex-col w-32 h-full border-r border-gray-400 pr-2 gap-1"
        >
          <button
            onClick={() => setTab("map")}
            className={classNames(
              "hover:text-blue-500 hover:bg-gray-50 p-1 rounded-sm w-full",
              {
                "text-blue-400": tab !== "map",
                "text-blue-500 bg-gray-50": tab === "map",
              },
            )}
          >
            Map
          </button>
          <button
            onClick={() => setTab("profiles")}
            className={classNames(
              "hover:text-blue-500 hover:bg-gray-50 p-1 rounded-sm w-full",
              {
                "text-blue-400": tab !== "profiles",
                "text-blue-500 bg-gray-50": tab === "profiles",
              },
            )}
          >
            Profiles
          </button>
        </div>
        <div className="pl-2 w-full">
          {tab === "profiles" && <ProfileSettings />}
        </div>
      </div>
    </div>
  );
}
