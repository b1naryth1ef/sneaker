import classNames from "classnames";
import Coord from "coordinate-parser";
import * as maptalks from "maptalks";
import * as mgrs from "mgrs";
import React, { useEffect, useState } from "react";
import {
  deleteGeometry,
  Geometry,
  geometryStore,
  setSelectedGeometry,
  updateGeometry,
} from "../stores/GeometryStore";
import DetailedCoords from "./DetailedCoords";

function maybeParseCoord(newCoord: string): null | [number, number] {
  try {
    const coord = new Coord(newCoord);
    return [
      coord.getLatitude(),
      coord.getLongitude(),
    ];
  } catch (e) {
    try {
      const coord = mgrs.toPoint(
        newCoord.replace(" ", ""),
      );
      return [coord[1], coord[0]];
    } catch (e) {
    }
  }
  return null;
}

function GeometryDetails({ geo, edit }: { geo: Geometry; edit: boolean }) {
  const [newCoord, setNewCoord] = useState<string>("");
  useEffect(() => {
    if (edit) setNewCoord("");
  }, [edit]);

  if (geo.type === "markpoint") {
    return (
      <>
        <div className="flex flex-row flex-grow w-full">
          <span className="pr-2 flex-grow">Name</span>
          {edit
            ? (
              <input
                className="flex-grow p-0.5 text-right"
                value={geo.name}
                onChange={(e) => {
                  updateGeometry({ ...geo, name: e.target.value });
                }}
              />
            )
            : geo.name}
        </div>
        <DetailedCoords coords={geo.position} />
        {edit &&
          (
            <>
              {/* TODO: sort out parsing coords from human input */}
              {(
                <div className="flex flex-row flex-grow w-full">
                  <span className="pr-2 flex-grow">Coords</span>
                  <input
                    className={classNames(
                      "flex-grow p-0.5 text-right rounded-sm",
                      {
                        "ring-red-600 ring": newCoord &&
                          maybeParseCoord(newCoord) === null,
                      },
                    )}
                    value={newCoord}
                    onChange={(e) => {
                      setNewCoord(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        try {
                          const coord = new Coord(newCoord);
                          updateGeometry({
                            ...geo,
                            position: [
                              coord.getLatitude(),
                              coord.getLongitude(),
                            ],
                          });
                        } catch (e) {
                          try {
                            const coord = mgrs.toPoint(
                              newCoord.replace(" ", ""),
                            );
                            updateGeometry({
                              ...geo,
                              position: [
                                coord[1],
                                coord[0],
                              ],
                            });
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }
                    }}
                  />
                </div>
              )}
              <button
                className="p-1 text-xs bg-red-200 border border-red-500 mt-2"
                onClick={() => {
                  deleteGeometry(geo.id);
                }}
              >
                Delete
              </button>
            </>
          )}
      </>
    );
  }
  return <></>;
}

export default function MapGeometryInfo(
  { map }: {
    map: maptalks.Map;
  },
) {
  const selectedGeometry = geometryStore((state) =>
    state.selectedGeometry !== null
      ? state.geometry.get(state.selectedGeometry)
      : undefined
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [selectedGeometry?.id]);

  useEffect(() => {
    if (!selectedGeometry) return () => {};
    const layer = (map.getLayer("custom-geometry") as maptalks.VectorLayer);
    const item = layer.getGeometryById(selectedGeometry.id);
    item.config("draggable", editing);
    return () => item.config("draggable", false);
  }, [editing]);

  if (!selectedGeometry) return <></>;

  return (
    <div
      className="m-2 absolute flex flex-col bg-gray-300 border border-gray-500 shadow select-none rounded-sm w-1/5"
    >
      <div className="p-2 bg-gray-400 text-sm flex flex-row">
        <b className="flex flex-grow">
          {selectedGeometry.name ||
            `${selectedGeometry.type} #${selectedGeometry.id}`}
        </b>
        {editing && (
          <button
            className="p-1 text-xs bg-green-200 border border-green-500"
            onClick={() => {
              setEditing(false);
            }}
          >
            Done
          </button>
        )}
        {!editing && (
          <button
            className="p-1 text-xs bg-green-200 border border-green-500"
            onClick={() => {
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
        <button
          className="p-1 text-xs bg-red-300 border border-red-400 ml-2"
          disabled={editing}
          onClick={() => {
            setSelectedGeometry(null);
          }}
        >
          Close
        </button>
      </div>
      <div className="p-2 flex flex-row">
        <div className="flex flex-col pr-2 w-full">
          <GeometryDetails geo={selectedGeometry} edit={editing} />
        </div>
      </div>
    </div>
  );
}