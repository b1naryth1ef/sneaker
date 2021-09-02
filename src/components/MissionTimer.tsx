import React, { useEffect, useState } from "react";
import { hackStore, popHack, pushHack } from "../stores/HackStore";
import { serverStore } from "../stores/ServerStore";
import { formatCounter } from "../util";

export function MissionTimer(): JSX.Element {
  const [currentTime, setCurrentTime] = useState("");
  const [hackTimes, setHackTimes] = useState<Array<[number, string]>>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      const serverState = serverStore.getState();
      const globalObject = serverState.entities.get(0);
      if (!globalObject) return;

      const referenceTime = Date.parse(
        globalObject.properties["ReferenceTime"] as string,
      );
      setCurrentTime(
        new Date(referenceTime + (serverState.offset * 1000)).toUTCString(),
      );

      setHackTimes(
        hackStore.getState().hacks.toArray().map((
          it,
        ) => [it, formatCounter(Math.round((serverState.offset - it)))]),
      );
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div
        className="absolute left-0 bottom-0 max-w-xl max-h-32 bg-gray-400 bg-opacity-20 p-1"
      >
        {hackTimes.map((
          [id, fmt],
        ) => (
          <div className="text-red-300 text-base flex flex-row" key={id}>
            <div>{fmt}</div>
            <div className="ml-auto">
              <button
                onClick={() => popHack(id)}
                className="text-red-500 hover:text-red-600 font-bold"
              >
                X
              </button>
            </div>
          </div>
        ))}
        {currentTime &&
          (
            <div
              className="text-red-500 text-xl cursor-pointer"
              onClick={() => pushHack()}
            >
              {currentTime}
            </div>
          )}
      </div>
    </>
  );
}
