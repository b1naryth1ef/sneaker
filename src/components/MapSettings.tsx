import React from "react";
import { settingsStore } from "../stores/SettingsStore";

export function MapSettings(): JSX.Element {
  const mapSettings = settingsStore((state) => state.map);
  console.log(mapSettings);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center pb-2 border-b border-gray-300">
        <div className="flex-grow">
          <h3 className="text-xl">Map Settings</h3>
        </div>
      </div>
      <div className="flex flex-grow flex-col gap-2">
        <label className="flex flex-row items-center">
          <h3>Enable track icons</h3>
          <input
            type="checkbox"
            className="form-checkbox ml-6"
            checked={mapSettings.showTrackIcons}
            onChange={() =>
              settingsStore.setState({
                map: {
                  ...mapSettings,
                  showTrackIcons: !mapSettings.showTrackIcons,
                },
              })}
          />
        </label>
        <label className="flex flex-row items-center">
          <h3>Enable track labels</h3>
          <input
            type="checkbox"
            className="form-checkbox ml-6"
            checked={mapSettings.showTrackLabels}
            onChange={() =>
              settingsStore.setState({
                map: {
                  ...mapSettings,
                  showTrackLabels: !mapSettings.showTrackLabels,
                },
              })}
          />
        </label>
      </div>
    </div>
  );
}
