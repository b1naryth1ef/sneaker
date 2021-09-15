import classNames from "classnames";
import * as maptalks from "maptalks";
import React, { useMemo, useState } from "react";
import { BiCog } from "react-icons/bi";
import { entityMetadataStore } from "../stores/EntityMetadataStore";
import { serverStore, setSelectedEntityId } from "../stores/ServerStore";
import {
  EntityTrackPing,
  estimatedSpeed,
  trackStore,
} from "../stores/TrackStore";
import { Entity } from "../types/entity";
import DrawConsoleTab from "./DrawConsoleTab";

function WatchTab(
  { map }: {
    map: maptalks.Map;
  },
) {
  const trackState = trackStore((state) => state);
  const entities = serverStore((state) => state.entities);

  const watches = trackState.trackOptions.entrySeq().map(
    ([entityId, trackOptions]) => {
      if (trackOptions.watching !== true) {
        return;
      }

      const track = trackState.tracks.get(entityId);
      if (!track) {
        return;
      }

      const entity = entities.get(entityId);
      if (!entity) {
        return;
      }

      return {
        entity,
        track,
      };
    },
  ).filter((obj) => obj !== undefined);

  return (
    <div className="p-2">
      {watches &&
        (
          <div className="my-2 flex flex-col gap-1">
            {watches.map((
              data,
            ) => {
              return (
                <button
                  onClick={() => {
                    setSelectedEntityId(data!.entity.id);
                    map.animateTo({
                      center: [data!.entity.longitude, data!.entity.latitude],
                      zoom: 10,
                    }, {
                      duration: 250,
                      easing: "out",
                    });
                  }}
                  className="p-1 bg-indigo-100 hover:border-indigo-300 hover:bg-indigo-200 border-indigo-200 border rounded-sm"
                >
                  {data!.entity.name} ({data!.entity.pilot || ""})
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}

function SearchTab(
  { map }: {
    map: maptalks.Map;
  },
) {
  const [search, setSearch] = useState("");

  const entityMetadata = entityMetadataStore((state) => state.entities);
  const matchFn = useMemo(() => {
    // Label query
    if (search.startsWith("@")) {
      const tag = search.slice(1).toLowerCase();
      if (!tag) return null;

      return (it: Entity) => {
        const meta = entityMetadata.get(it.id);
        return meta && meta.labels.includes(tag);
      };
    } else {
      return (it: Entity) =>
        (it.types.includes("Air") || it.types.includes("Sea")) &&
          it.name.toLowerCase().includes(search) ||
        (it.pilot !== undefined && it.pilot.toLowerCase().includes(search));
    }
  }, [search, entityMetadata]);

  const matchedEntities = serverStore((state) =>
    matchFn ? state.entities.valueSeq().filter(matchFn).toArray() : []
  );
  const tracks = new Map(trackStore(
    ((state) => matchedEntities.map((it) => [it.id, state.tracks.get(it.id)])),
  ));
  const targetEntities = matchedEntities.map((it) =>
    [it, tracks.get(it.id)] as [Entity, Array<EntityTrackPing> | undefined]
  )
    .filter((it) =>
      it[0].types.includes("Sea") ||
      it[1] !== undefined && estimatedSpeed(it[1]) >= 25
    ).map((
      it,
    ) => it[0]);

  return (
    <div className="p-2">
      <input
        className="form-input mt-1 block w-full p-1"
        value={search}
        onChange={(e) => setSearch(e.target.value.toLowerCase())}
      />
      {search !== "" && matchedEntities &&
        (
          <div className="my-2 flex flex-col gap-1">
            {targetEntities.map((
              entity,
            ) => {
              return (
                <button
                  onClick={() => {
                    setSelectedEntityId(entity.id);
                    map.animateTo({
                      center: [entity.longitude, entity.latitude],
                      zoom: 10,
                    }, {
                      duration: 250,
                      easing: "out",
                    });
                  }}
                  className="bg-indigo-100 hover:border-indigo-300 hover:bg-indigo-200 border-indigo-200 border rounded-sm"
                >
                  {entity.name} ({entity.pilot || ""})
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}

export function Console(
  { map, setSettingsOpen }: {
    setSettingsOpen: (value: boolean) => void;
    map: maptalks.Map;
  },
) {
  const [selectedTab, setSelectedTab] = useState<
    null | "search" | "watch" | "draw"
  >(
    null,
  );

  return (
    <div
      className="m-2 absolute flex flex-col bg-gray-200 border border-gray-500 shadow select-none rounded-sm right-0 max-w-3xl max-h-96 overflow-x-auto no-scrollbar"
    >
      <div className="bg-gray-300 text-sm p-2 flex flex-row gap-2">
        <div>
          <button
            onClick={() => setSelectedTab("search")}
            className={classNames(
              "border bg-blue-100 border-blue-300 p-1 rounded-sm shadow-sm",
              { "bg-blue-200": selectedTab === "search" },
            )}
          >
            Search
          </button>
        </div>
        <div>
          <button
            onClick={() => setSelectedTab("watch")}
            className={classNames(
              "border bg-blue-100 border-blue-300 p-1 rounded-sm shadow-sm",
              { "bg-blue-200": selectedTab === "watch" },
            )}
          >
            Watches
          </button>
        </div>
        <div>
          <button
            onClick={() => setSelectedTab("draw")}
            className={classNames(
              "border bg-blue-100 border-blue-300 p-1 rounded-sm shadow-sm",
              { "bg-blue-200": selectedTab === "draw" },
            )}
          >
            Draw
          </button>
        </div>
        <div className="ml-auto flex flex-row gap-1">
          {
            /* {selectedTab !== null && (
            <button
              className="border bg-red-100 border-red-300 p-1 rounded-sm shadow-sm"
              onClick={() => setSelectedTab(null)}
            >
              Close
            </button>
          )} */
          }
          <button
            className="border bg-blue-100 border-blue-300 p-1 rounded-sm shadow-sm flex flex-row items-center"
            onClick={() => setSettingsOpen(true)}
          >
            <BiCog className="inline-block w-4 h-4" />
          </button>
        </div>
      </div>
      {selectedTab === "search" &&
        <SearchTab map={map} />}
      {selectedTab === "watch" &&
        <WatchTab map={map} />}
      {selectedTab === "draw" &&
        <DrawConsoleTab map={map} />}
    </div>
  );
}
