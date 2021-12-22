import classNames from "classnames";
import React from "react";
import { BiCheckbox, BiCheckboxChecked } from "react-icons/bi";
import { serverStore } from "../stores/ServerStore";
import { GroundUnitMode, settingsStore } from "../stores/SettingsStore";

function BigCheckbox({
  checked,
  toggle,
  className,
}: {
  checked: boolean;
  toggle: () => void;
  className?: string;
}): JSX.Element {
  return checked ? (
    <BiCheckboxChecked
      className={classNames("inline-block w-16 h-16 p-2", className)}
      onClick={() => {
        toggle();
      }}
    />
  ) : (
    <BiCheckbox
      className={classNames("inline-block w-16 h-16 p-2", className)}
      onClick={() => {
        toggle();
      }}
    />
  );
}

export function MapSettings(): JSX.Element {
  const server = serverStore((state) => state.server);
  const mapSettings = settingsStore((state) => state.map);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center pb-2 border-b border-gray-300">
        <div className="flex-grow">
          <h3 className="text-xl">Map Settings</h3>
        </div>
      </div>
      <div className="flex flex-grow flex-col gap-2">
        <label className="flex flex-row items-center">
          <div className="flex flex-col">
            <h3 className="font-bold select-none">Enable Track Icons</h3>
            <p className="text-sm text-gray-700 select-none">
              Displays NATO symbology based on the type of radar track.
            </p>
          </div>
          <BigCheckbox
            toggle={() => {
              settingsStore.setState({
                map: {
                  ...mapSettings,
                  showTrackIcons: !mapSettings.showTrackIcons,
                },
              });
            }}
            checked={mapSettings.showTrackIcons !== false}
            className="ml-auto"
          />
        </label>
        <label className="flex flex-row items-center">
          <div className="flex flex-col">
            <h3 className="font-bold select-none">Enable Track Labels</h3>
            <p className="text-sm text-gray-700 select-none">
              Displays airframe type and NATO designation based on type of radar
              track.
            </p>
          </div>
          <BigCheckbox
            toggle={() =>
              settingsStore.setState({
                map: {
                  ...mapSettings,
                  showTrackLabels: !mapSettings.showTrackLabels,
                },
              })
            }
            checked={mapSettings.showTrackLabels !== false}
            className="ml-auto"
          />
        </label>
        <label className="flex flex-row items-center">
          <div className="flex flex-col">
            <h3 className="font-bold select-none">
              Previous Ping Display Count
            </h3>
            <p className="text-sm text-gray-700 select-none">
              Number of previous radar-sweep pings to display in-trail for a
              tracks.
            </p>
          </div>
          <input
            className="form-input mt-1 block w-full p-1"
            value={mapSettings.trackTrailLength}
            onChange={(e) =>
              settingsStore.setState((state) => ({
                ...state,
                map: {
                  ...state.map,
                  trackTrailLength: parseInt(e.target.value),
                },
              }))
            }
          />
        </label>
        <label className="flex flex-row items-center">
          <div className="flex flex-col">
            <h3 className="font-bold select-none">Ground Unit Display Mode</h3>
            <p className="text-sm text-gray-700 select-none">
              Select which ground units to display. Some options may not be
              available based on server settings.
            </p>
          </div>
          <select
            value={mapSettings.groundUnitMode || "none"}
            className="form-select ml-auto border rounded-sm p-2 border-gray-400"
            onChange={(e) => {
              const value =
                e.target.value === "none"
                  ? undefined
                  : (e.target.value as GroundUnitMode);
              settingsStore.setState({
                map: {
                  ...mapSettings,
                  groundUnitMode: value,
                },
              });
            }}
          >
            <option key="none" value="none">
              None
            </option>
            <option
              key="friendly"
              value={GroundUnitMode.FRIENDLY}
              disabled={
                !server ||
                !server.ground_unit_modes?.includes(GroundUnitMode.FRIENDLY)
              }
            >
              Friendly
            </option>
            <option
              key="enemy"
              value={GroundUnitMode.ENEMY}
              disabled={
                !server ||
                !server.ground_unit_modes?.includes(GroundUnitMode.ENEMY)
              }
            >
              Enemy (JTAC-Mode)
            </option>
          </select>
        </label>
      </div>
    </div>
  );
}
