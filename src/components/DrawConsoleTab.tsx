import classNames from "classnames";
import * as maptalks from "maptalks";
import React from "react";
import { BiShapeCircle, BiShapeSquare } from "react-icons/bi";
import {
  addMarkPoint,
  addZone,
  geometryStore,
  setSelectedGeometry,
} from "../stores/GeometryStore";

export default function DrawConsoleTab({ map }: { map: maptalks.Map }) {
  const [geometry, selectedId] = geometryStore((state) => [
    state.geometry,
    state.selectedGeometry,
  ]);

  return (
    <div className="p-2">
      <div className="flex flex-row text-left items-center w-full gap-2">
        <button
          className="bg-green-100 hover:bg-green-200 border-green-400 p-1 border rounded-sm text-sm text-green-700 flex-row items-center w-full"
          onClick={() => {
            const center = map.getCenter();
            addMarkPoint([center.y, center.x]);
          }}
        >
          Mark
          <BiShapeCircle className="ml-2 inline-block" />
        </button>
        <button
          className="bg-green-100 hover:bg-green-200 border-green-400 p-1 border rounded-sm text-sm text-green-700 flex-row items-center w-full"
          onClick={() => {
            const center = map.getCenter();
            addZone([
              [center.y + 0.1, center.x + 0.1],
              [center.y - 0.1, center.x - 0.1],
              [center.y + 0.1, center.x - 0.1],
            ]);
          }}
        >
          Zone
          <BiShapeSquare className="ml-2 inline-block" />
        </button>
      </div>
      <div className="my-2 flex flex-col gap-1">
        {geometry.valueSeq().map((it) => {
          return (
            <button
              key={it.id}
              className={classNames(
                "bg-indigo-100 hover:border-indigo-300 hover:bg-indigo-200 border-indigo-200 border rounded-sm p-1",
                { "bg-indigo-200 border-indigo-300": it.id === selectedId }
              )}
              onClick={() => {
                setSelectedGeometry(it.id);

                let position;
                if (it.type === "markpoint") {
                  position = [it.position[1], it.position[0]];
                }

                if (position) {
                  map.animateTo(
                    {
                      center: position,
                      zoom: 10,
                    },
                    {
                      duration: 250,
                      easing: "out",
                    }
                  );
                }
              }}
            >
              {it.name || `${it.type} #${it.id}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
