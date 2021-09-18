import classNames from "classnames";
import React, { useState } from "react";
import { BiX } from "react-icons/bi";
import { Link } from "react-router-dom";
import { AboutSettings } from "./AboutSettings";
import { DebugSettings } from "./DebugSettings";
import { MapSettings } from "./MapSettings";
import { ProfileSettings } from "./ProfileSettings";

type SettingsTabs = "home" | "map" | "profiles" | "debug" | "about";

function SettingsHome() {
  return (
    <div className="flex flex-col gap-2 text-center mt-auto">
      <Link
        to="/"
        className="bg-red-100 border-red-300 text-red-400 border ml-2 p-1"
      >
        Disconnect
      </Link>
      <button
        onClick={() => {
          if (confirm("Clear all local data and refresh?")) {
            localStorage.clear();
            window.location.reload();
          }
        }}
        className="bg-red-100 border-red-300 text-red-400 border ml-2 p-1"
      >
        Clear Local Data
      </button>
    </div>
  );
}

function SettingsTab(
  { name, active, setTab }: {
    active: boolean;
    name: SettingsTabs;
    setTab: (v: SettingsTabs) => void;
  },
) {
  return (
    <button
      onClick={() => setTab(name)}
      className={classNames(
        "hover:text-blue-500 hover:bg-gray-50 p-1 rounded-sm w-full",
        {
          "text-blue-400": !active,
          "text-blue-500 bg-gray-50": active,
        },
      )}
    >
      {name[0].toUpperCase() + name.slice(1)}
    </button>
  );
}

export function Settings({ close }: { close: () => void }): JSX.Element {
  const [tab, setTab] = useState<SettingsTabs>("home");

  return (
    <div
      className={classNames(
        "flex flex-col overflow-x-hidden overflow-y-auto absolute",
        "inset-0 z-50 bg-gray-200 mx-auto my-auto max-w-3xl",
        "border border-gray-200 rounded-sm shadow-md",
      )}
      style={{ maxHeight: "80%" }}
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
          <SettingsTab setTab={setTab} name="home" active={tab === "home"} />
          <SettingsTab setTab={setTab} name="map" active={tab === "map"} />
          <SettingsTab
            setTab={setTab}
            name="profiles"
            active={tab === "profiles"}
          />
          <SettingsTab setTab={setTab} name="debug" active={tab === "debug"} />
          <SettingsTab setTab={setTab} name="about" active={tab === "about"} />
        </div>
        <div className="pl-2 w-full">
          {tab === "home" && <SettingsHome />}
          {tab === "map" && <MapSettings />}
          {tab === "profiles" && <ProfileSettings />}
          {tab === "debug" && <DebugSettings />}
          {tab === "about" && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}
