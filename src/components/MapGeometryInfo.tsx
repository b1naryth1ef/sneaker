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
  updateGeometrySafe,
} from "../stores/GeometryStore";
import DetailedCoords from "./DetailedCoords";

function maybeParseCoord(newCoord: string): null | [number, number] {
  try {
    const coord = new Coord(newCoord);
    return [coord.getLatitude(), coord.getLongitude()];
  } catch (e) {
    try {
      const coord = mgrs.toPoint(newCoord.replace(" ", ""));
      return [coord[1], coord[0]];
    } catch (e) {}
  }
  return null;
}

function GeometryDetails({ geo, edit }: { geo: Geometry; edit: boolean }) {
  const [newCoord, setNewCoord] = useState<string>("");

  useEffect(() => {
    if (edit) setNewCoord("");
  }, [edit]);

  return (
    <>
      <div className="flex flex-row flex-grow w-full">
        <span className="pr-2 flex-grow">Name</span>
        {edit ? (
          <input
            className="flex-grow p-0.5 text-right"
            value={geo.name}
            onChange={(e) => {
              updateGeometrySafe(geo.id, { name: e.target.value });
            }}
          />
        ) : (
          geo.name
        )}
      </div>
      {geo.type === "markpoint" && <DetailedCoords coords={geo.position} />}
      {geo.type === "markpoint" && edit && (
        <>
          {/* TODO: sort out parsing coords from human input */}
          {
            <div className="flex flex-row flex-grow w-full">
              <span className="pr-2 flex-grow">Coords</span>
              <input
                className={classNames("flex-grow p-0.5 text-right rounded-sm", {
                  "ring-red-600 ring":
                    newCoord && maybeParseCoord(newCoord) === null,
                })}
                value={newCoord}
                onChange={(e) => {
                  setNewCoord(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    try {
                      const coord = new Coord(newCoord);
                      updateGeometrySafe(geo.id, {
                        position: [coord.getLatitude(), coord.getLongitude()],
                      });
                    } catch (e) {
                      try {
                        const coord = mgrs.toPoint(newCoord.replace(" ", ""));
                        updateGeometrySafe(geo.id, {
                          position: [coord[1], coord[0]],
                        });
                      } catch (e) {
                        console.error(e);
                      }
                    }
                  }
                }}
              />
            </div>
          }
        </>
      )}
    </>
  );
}

export default function MapGeometryInfo({ map }: { map: maptalks.Map }) {
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
    const layer = map.getLayer("custom-geometry") as maptalks.VectorLayer;
    const item = layer.getGeometryById(
      selectedGeometry.id
    ) as maptalks.GeometryCollection;

    const geo = item.getGeometries()[0];
    if (selectedGeometry.type === "zone") {
      if (editing) {
        geo.startEdit();
      } else {
        geo.endEdit();
      }
    } else {
      item.config("draggable", editing);
    }

    return () => {
      if (selectedGeometry.type === "zone") {
        geo.endEdit();
      } else {
        item.config("draggable", false);
      }
    };
  }, [editing]);

  if (!selectedGeometry) return <></>;

  return (
    <div className="flex flex-col bg-gray-300 border border-gray-500 shadow select-none rounded-sm">
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
          onClick={() => {
            setEditing(false);
            setSelectedGeometry(null);
          }}
        >
          Close
        </button>
      </div>
      <div className="p-2 flex flex-row">
        <div className="flex flex-col pr-2 w-full">
          <GeometryDetails geo={selectedGeometry} edit={editing} />
          <button
            className="p-1 text-xs bg-red-200 border border-red-500 mt-2"
            onClick={() => {
              deleteGeometry(selectedGeometry.id);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
