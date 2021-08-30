import * as maptalks from "maptalks";
import ms from "milsymbol";
import React, { MutableRefObject, useEffect, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { computeDistanceBetween } from "spherical-geometry-js";
import { DCSMap } from "../dcs/maps/DCSMap";
import { serverStore } from "../stores/ServerStore";
import {
  EntityTrackPing,
  estimatedAltitudeRate,
  estimatedSpeed,
  setTrackOptions,
  trackStore,
} from "../stores/TrackStore";
import { Entity } from "../types/entity";
import { computeBRAA, getBearing, getCardinal } from "../util";
import { colorMode } from "./MapIcon";

const iconCache: Record<string, string> = {};

function EntityInfo(
  { map, entity, track }: {
    map: maptalks.Map;
    entity: Entity;
    track: Array<EntityTrackPing>;
  },
) {
  const trackOptions = trackStore((state) => state.trackOptions.get(entity.id));

  return (
    <div
      className="m-2 absolute flex flex-col bg-gray-300 border border-gray-500 shadow select-none rounded-sm"
    >
      <div className="p-2 bg-gray-400 text-sm">
        <b>{entity.group}</b>
      </div>
      <div className="p-2 flex flex-row">
        <div className="flex flex-col pr-2">
          <div>{entity.name}</div>
          <div>{entity.pilot}</div>
          <div>
            Heading: {Math.round(entity.heading)}
            {getCardinal(entity.heading)}
          </div>
          <div>Altitude: {Math.round(entity.altitude * 3.28084)}</div>
          <div>GS: {Math.round(estimatedSpeed(track))}</div>
        </div>
        <div
          className="flex flex-col border-l border-black px-2 gap-1 flex-grow"
        >
          <button
            className="p-1 text-xs bg-blue-300 border border-blue-400"
            onClick={() => {
              console.log("ANIMATING MAP");
              map.animateTo({
                center: [entity.longitude, entity.latitude],
                zoom: 10,
              }, {
                duration: 250,
                easing: "out",
              });
            }}
          >
            Snap
          </button>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row flex-grow">
              <span className="text-yellow-600 pr-2 flex-grow">WR</span>
              <input
                className="w-16"
                value={trackOptions?.warningRadius || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== NaN) {
                    setTrackOptions(entity.id, {
                      warningRadius: val,
                    });
                  }
                }}
              />
            </div>
            <div className="flex flex-row flex-grow">
              <span className="text-red-600 pr-2 flex-grow">TR</span>
              <input
                className="w-16"
                value={trackOptions?.threatRadius || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== NaN) {
                    setTrackOptions(entity.id, {
                      threatRadius: val,
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapSimpleEntity(
  { map, entity, size, strokeWidth }: {
    map: maptalks.Map;
    entity: Entity;
    size?: number;
    strokeWidth?: number;
  },
) {
  useEffect(() => {
    const trailLayer = map.getLayer("trails") as maptalks.VectorLayer;
    let marker = trailLayer.getGeometryById(
      `${entity.id}-icon`,
    ) as maptalks.Marker;
    if (!marker) {
      if (iconCache[entity.sidc] === undefined) {
        iconCache[entity.sidc] = new ms.Symbol(entity.sidc, {
          size: size || 16,
          frame: true,
          fill: false,
          colorMode: colorMode,
          strokeWidth: strokeWidth || 8,
        }).toDataURL();
      }
      marker = new maptalks.Marker(
        [entity.longitude, entity.latitude],
        {
          id: `${entity.id}-icon`,
          draggable: false,
          visible: true,
          editable: false,
          symbol: {
            markerFile: iconCache[entity.sidc],
            markerDy: 10,
          },
        },
      );
      trailLayer.addGeometry(
        marker,
      );
    } else {
      marker.setCoordinates([
        entity.longitude,
        entity.latitude,
      ]);
    }
  }, [entity]);

  return <></>;
}

function MapRadarTracks(
  { map, selectedEntityId, setSelectedEntityId }: {
    map: maptalks.Map;
    selectedEntityId: number | null;
    setSelectedEntityId: (v: number | null) => void;
  },
) {
  const radarTracks = trackStore((state) => state.tracks.entrySeq().toArray());
  useEffect(() => {
    const entities = serverStore.getState().entities;
    const tracks = trackStore.getState().tracks;

    const vvLayer = map.getLayer("track-vv") as maptalks.VectorLayer;
    const trailLayer = map.getLayer("trails") as maptalks.VectorLayer;
    const infoLayer = map.getLayer("track-info") as maptalks.VectorLayer;
    const alertLayer = map.getLayer(
      "track-alert-radius",
    ) as maptalks.VectorLayer;
    for (const geo of vvLayer.getGeometries()) {
      if (!entities.has(geo.id as number)) {
        geo.remove();
      }
    }

    for (const geo of trailLayer.getGeometries()) {
      const geoA: any = geo;
      if (!geoA._id) continue;
      const [geoId, _] = (geoA._id as string).split("-");
      if (!entities.has(parseInt(geoId))) {
        geo.remove();
      }
    }

    for (const geo of infoLayer.getGeometries()) {
      const geoA: any = geo;
      if (!geoA._id) continue;
      const [geoId, _] = (geoA._id as string).split("-");
      if (!entities.has(parseInt(geoId))) {
        geo.remove();
      }
    }

    for (const geo of alertLayer.getGeometries()) {
      const geoA: any = geo;
      if (!geoA._id) continue;
      const [geoId, _] = (geoA._id as string).split("-");
      if (!entities.has(parseInt(geoId))) {
        geo.remove();
      }
    }

    for (const [entityId, track] of radarTracks) {
      const trackVisible = estimatedSpeed(track) >= 25;
      const entity = entities.get(entityId);
      if (!entity) {
        continue;
      }

      const trackOptions = trackStore.getState().trackOptions.get(entityId);

      const iconGeo = trailLayer.getGeometryById(
        `${entityId}-icon`,
      ) as maptalks.Marker;
      if (!iconGeo) {
        if (iconCache[entity.sidc] === undefined) {
          iconCache[entity.sidc] = new ms.Symbol(entity.sidc, {
            size: 16,
            frame: true,
            fill: false,
            colorMode: colorMode,
            strokeWidth: 8,
          }).toDataURL();
        }
        const iconGeo = new maptalks.Marker(
          [entity.longitude, entity.latitude],
          {
            id: `${entityId}-icon`,
            draggable: false,
            visible: true,
            editable: false,
            symbol: {
              markerFile: iconCache[entity.sidc],
              markerDy: 10,
            },
          },
        );

        trailLayer.addGeometry(
          iconGeo,
        );
        iconGeo.on("click", (e) => {
          setSelectedEntityId(entity.id);
        });
      } else {
        iconGeo.setCoordinates(
          [entity.longitude, entity.latitude],
        );
        trackVisible ? iconGeo.show() : iconGeo.hide();
      }

      const infoGeo = infoLayer.getGeometryById(
        `${entityId}-info`,
      ) as maptalks.Label;
      if (!infoGeo) {
        const infoText = new maptalks.Label("test", [0, 0], {
          id: `${entityId}-info`,
          draggable: false,
          visible: true,
          editable: false,
          boxStyle: {
            "padding": [2, 2],
            "horizontalAlignment": "left",
            "symbol": {
              "markerType": "square",
              "markerFill": "#4B5563",
              "markerFillOpacity": 0.5,
              "markerLineColor": entity.coalition !== "Allies"
                ? "#17c2f6"
                : "#ff8080",
              textHorizontalAlignment: "right",
              textDx: 20,
            },
          },
          "textSymbol": {
            "textFaceName": '"microsoft yahei"',
            "textFill": "white",
            "textSize": 12,
          },
        });
        infoText.on("click", (e) => {
          setSelectedEntityId(entity.id);
        });
        infoLayer.addGeometry(infoText);
      } else {
        let name = entity.name;
        if (entity.pilot && !entity.pilot.startsWith(entity.group)) {
          name = `${entity.pilot} (${name})`;
        }

        (infoGeo.setContent as any)(name);
        infoGeo.setCoordinates(
          [entity.longitude, entity.latitude],
        );
        trackVisible ? infoGeo.show() : infoGeo.hide();
      }

      const infoAltitudeGeo = infoLayer.getGeometryById(
        `${entityId}-altitude`,
      ) as maptalks.Label;
      if (!infoAltitudeGeo) {
        const infoAltitudeText = new maptalks.Label("", [0, 0], {
          id: `${entityId}-altitude`,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            "padding": [2, 2],
            "horizontalAlignment": "left",
            "symbol": {
              "markerType": "square",
              "markerFillOpacity": 0,
              "markerLineOpacity": 0,
              textHorizontalAlignment: "right",
              textDx: 20,
              textDy: 18,
            },
          },
          "textSymbol": {
            "textFaceName": '"microsoft yahei"',
            "textFill": "#FFC0CB",
            "textSize": 12,
          },
        });
        infoLayer.addGeometry(infoAltitudeText);
      } else {
        (infoAltitudeGeo.setContent as any)(
          `${
            Math.floor(
              (entity.altitude * 3.28084) / 1000,
            )
          }`,
        );
        infoAltitudeGeo.setCoordinates(
          [entity.longitude, entity.latitude],
        );
        trackVisible ? infoAltitudeGeo.show() : infoAltitudeGeo.hide();
      }

      const infoSpeedGeo = infoLayer.getGeometryById(
        `${entityId}-speed`,
      ) as maptalks.Label;
      if (!infoSpeedGeo) {
        const infoSpeedText = new maptalks.Label("", [0, 0], {
          id: `${entityId}-speed`,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            "padding": [2, 2],
            "horizontalAlignment": "left",
            "symbol": {
              "markerType": "square",
              "markerFillOpacity": 0,
              "markerLineOpacity": 0,
              textHorizontalAlignment: "right",
              textDx: 40,
              textDy: 18,
            },
          },
          "textSymbol": {
            "textFaceName": '"microsoft yahei"',
            "textFill": "orange",
            "textSize": 12,
          },
        });
        infoLayer.addGeometry(infoSpeedText);
      } else {
        (infoSpeedGeo.setContent as any)(
          `${Math.round(estimatedSpeed(track))}`,
        );
        infoSpeedGeo.setCoordinates(
          [entity.longitude, entity.latitude],
        );
        trackVisible ? infoSpeedGeo.show() : infoSpeedGeo.hide();
      }

      const infoAltRateGeo = infoLayer.getGeometryById(
        `${entityId}-altrate`,
      ) as maptalks.Label;
      if (!infoAltRateGeo) {
        const infoAltRateText = new maptalks.Label("", [0, 0], {
          id: `${entityId}-altrate`,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            "padding": [2, 2],
            "horizontalAlignment": "left",
            "symbol": {
              "markerType": "square",
              "markerFillOpacity": 0,
              "markerLineOpacity": 0,
              textHorizontalAlignment: "right",
              textDx: 70,
              textDy: 18,
            },
          },
          "textSymbol": {
            "textFaceName": '"microsoft yahei"',
            "textFill": "#6EE7B7",
            "textSize": 12,
          },
        });
        infoLayer.addGeometry(infoAltRateText);
      } else {
        (infoAltRateGeo.setContent as any)(
          `${Math.round(estimatedAltitudeRate(track))}`,
        );
        infoAltRateGeo.setCoordinates(
          [entity.longitude, entity.latitude],
        );
        trackVisible ? infoAltRateGeo.show() : infoAltRateGeo.hide();
      }

      let threatCircle = alertLayer.getGeometryById(
        `${entityId}-threat`,
      ) as maptalks.Circle;
      if (!threatCircle) {
        threatCircle = new maptalks.Circle([0, 0], 500, {
          id: `${entityId}-threat`,
          draggable: false,
          visible: false,
          editable: false,
          symbol: {
            lineColor: "red",
            lineWidth: 2,
            lineOpacity: 0.75,
          },
        });
        alertLayer.addGeometry(threatCircle);
      } else {
        if (trackOptions?.threatRadius) {
          threatCircle.setCoordinates(
            [entity.longitude, entity.latitude],
          );
          threatCircle.setRadius(
            trackOptions.threatRadius * 1609.34,
          );
          trackVisible ? threatCircle.show() : threatCircle.hide();
        } else {
          threatCircle.hide();
        }
      }

      let warningCircle = alertLayer.getGeometryById(
        `${entityId}-warning`,
      ) as maptalks.Circle;
      if (!warningCircle) {
        warningCircle = new maptalks.Circle([0, 0], 500, {
          id: `${entityId}-warning`,
          draggable: false,
          visible: false,
          editable: false,
          symbol: {
            lineColor: "yellow",
            lineWidth: 2,
            lineOpacity: 0.75,
          },
        });
        alertLayer.addGeometry(warningCircle);
      } else {
        if (trackOptions?.warningRadius) {
          warningCircle.setCoordinates(
            [entity.longitude, entity.latitude],
          );
          warningCircle.setRadius(
            trackOptions.warningRadius * 1609.34,
          );
          trackVisible ? warningCircle.show() : warningCircle.hide();
        } else {
          warningCircle.hide();
        }
      }

      let index = 0;
      for (const trackPoint of track.slice(1)) {
        const trackPointGeo = trailLayer.getGeometryById(
          `${entityId}-${index}`,
        ) as maptalks.Marker;
        if (!trackPointGeo) {
          trailLayer.addGeometry(
            new maptalks.Marker([
              trackPoint.position[1],
              trackPoint.position[0],
            ], {
              id: `${entityId}-${index}`,
              visible: trackVisible,
              editable: false,
              shadowBlur: 0,
              draggable: false,
              dragShadow: false,
              drawOnAxis: null,
              symbol: {},
            }),
          );
        } else {
          if (trackVisible) {
            trackPointGeo.show();
          } else {
            trackPointGeo.hide();
          }
          trackPointGeo.setCoordinates([
            trackPoint.position[1],
            trackPoint.position[0],
          ]);
          trackPointGeo.setSymbol(
            {
              "markerType": "square",
              "markerFill": !trackVisible || track.length < 5
                ? "white"
                : entity.coalition !== "Allies"
                ? "#17c2f6"
                : "#ff8080",
              "markerLineColor": "black",
              "markerLineOpacity": 0.2,
              "markerLineWidth": 1,
              "markerWidth": 5,
              "markerHeight": 5,
              "markerDx": 0,
              "markerDy": 0,
              "markerFillOpacity": (100 - (index * 10)) / 100,
            },
          );
        }

        index++;
      }

      const speed = track && estimatedSpeed(track);
      const dirArrowEnd = speed && speed >= 25 && track && track.length >= 5 &&
        computeBRAA(
          track[0].position[0],
          track[0].position[1],
          track[0].heading,
          // knots -> meters per second -> 30 seconds
          ((speed * 0.514444)) * 30,
        );
      const geo = vvLayer.getGeometryById(
        entityId,
      ) as (maptalks.LineString | null);

      if (dirArrowEnd) {
        if (!geo) {
          vvLayer.addGeometry(
            new maptalks.LineString([
              [track[0].position[1], track[0].position[0]],
              [dirArrowEnd[1], dirArrowEnd[0]],
            ], {
              id: entityId,
              arrowStyle: "classic",
              arrowPlacement: "vertex",
              symbol: {
                "lineColor": entity.coalition !== "Allies"
                  ? "#17c2f6"
                  : "#ff8080",
                "lineWidth": 1.5,
              },
            }),
          );
        } else {
          geo.setCoordinates([
            [track[0].position[1], track[0].position[0]],
            [dirArrowEnd[1], dirArrowEnd[0]],
          ]);
        }
        geo?.show();
      } else {
        geo?.hide();
        // TODO: idk
      }
    }
  }, [radarTracks]);

  useEffect(() => {
    const alertLayer = map.getLayer(
      "track-alert-radius",
    ) as maptalks.VectorLayer;
    for (const geo of alertLayer.getGeometries()) {
      const [entityId, typeName] = ((geo as any)._id as string).split("-");
      if (selectedEntityId && parseInt(entityId) === selectedEntityId) {
        if (typeName === "threat") {
          geo.setSymbol({
            lineColor: "red",
            lineWidth: 2,
            lineOpacity: 0.75,
          });
        } else if (typeName === "warning") {
          geo.setSymbol({
            lineColor: "yellow",
            lineWidth: 2,
            lineOpacity: 0.60,
          });
        }
      } else {
        if (typeName === "threat") {
          geo.setSymbol({
            lineColor: "red",
            lineWidth: 1,
            lineOpacity: 0.50,
          });
        } else if (typeName === "warning") {
          geo.setSymbol({
            lineColor: "yellow",
            lineWidth: 1,
            lineOpacity: 0.25,
          });
        }
      }
    }
  }, [radarTracks, selectedEntityId]);

  return <></>;
}

export function Map({ dcsMap }: { dcsMap: DCSMap }) {
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const map: MutableRefObject<maptalks.Map | null> = useRef(null);
  const entityInfoPanel: MutableRefObject<maptalks.control.Panel | null> =
    useRef(null);
  const selectedCircle: MutableRefObject<maptalks.Circle | null> = useRef(null);
  const [zoom, setZoom] = useState<number>(8);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);

  const [drawBraaStart, setDrawBraaStart] = useState<
    [number, number] | null
  >(null);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(
    null,
  );

  const [selectedEntity, bullsEntity, ships] = serverStore((
    state,
  ) => [
    selectedEntityId && state.entities.get(selectedEntityId),
    state.entities.find((it) =>
      it.types.includes("Bullseye") && it.coalition !== "Allies"
    ),
    state.entities.filter((it) => it.types.includes("Sea")),
  ]);
  const selectedTrack = trackStore((state) =>
    selectedEntityId && state.tracks.get(selectedEntityId)
  );

  useEffect(() => {
    if (!mapContainer.current || map.current !== null) {
      return;
    }

    var braaLine = new maptalks.LineString([], {
      id: "braa-line",
      arrowStyle: null,
      visible: false,
      editable: false,
      cursor: null,
      shadowBlur: 0,
      shadowColor: "black",
      draggable: false,
      dragShadow: false,
      drawOnAxis: null,
      symbol: {
        "lineColor": "yellow",
        "lineWidth": 2,
      },
    });

    var braaText = new maptalks.Label("", [0, 0], {
      id: "braa-text",
      "draggable": false,
      visible: false,
      editable: false,
      "boxStyle": {
        "padding": [2, 2],
        "verticalAlignment": "top",
        "horizontalAlignment": "left",
        "symbol": {
          "markerType": "square",
          "markerFill": "rgb(135,196,240)",
          "markerFillOpacity": 0.9,
          "markerLineColor": "#34495e",
          "markerLineWidth": 1,
        },
      },
      "textSymbol": {
        "textFaceName": '"microsoft yahei"',
        "textFill": "white",
        "textSize": 18,
        "textVerticalAlignment": "top",
      },
    });

    selectedCircle.current = new maptalks.Circle([0, 0], 500, {
      visible: false,
      symbol: {
        lineColor: "white",
        lineWidth: 2,
        lineOpacity: 0.75,
      },
    });

    entityInfoPanel.current = new maptalks.control.Panel({
      "position": "bottom-left",
      "draggable": true,
      "custom": false,
      "content": renderToString(
        <div></div>,
      ),
    });

    map.current = new maptalks.Map(mapContainer.current, {
      layerCanvasLimitOnInteracting: -1,
      hitDetect: false,
      panAnimation: false,
      dragRotate: false,
      dragPitch: false,
      touchZoom: false,
      doubleClickZoom: false,
      fpsOnInteracting: 0,
      center: [dcsMap.center[1], dcsMap.center[0]],
      zoom: 8,
      seamlessZoom: true,
      baseLayer: new maptalks.TileLayer("base", {
        urlTemplate:
          "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c"],
      }),
      layers: [
        new maptalks.VectorLayer("trails", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("track-vv", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("track-info", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("track-alert-radius", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("braa", [
          braaLine,
          braaText,
          selectedCircle.current,
        ], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
      ],
    } as any);

    map.current.addControl(entityInfoPanel.current);

    map.current.on("contextmenu", (e) => {
    });

    map.current.on("zooming", (e) => {
      setZoom(map.current!.getZoom());
    });

    map.current.on("mousemove", (e) => {
      setCursorPos([e.coordinate.y, e.coordinate.x]);
    });

    map.current.on("mousedown", (e) => {
      if (e.domEvent.button === 2) {
        setDrawBraaStart(
          [e.coordinate.y, e.coordinate.x],
        );
      }
    });

    map.current.on("mouseup", (e) => {
      if (e.domEvent.button === 2) {
        setDrawBraaStart(null);
      }
    });
  }, [mapContainer, map]);

  useEffect(() => {
    if (!selectedCircle.current || !map.current) return;

    if (selectedEntity && selectedTrack) {
      const speed = estimatedSpeed(selectedTrack);
      if (speed < 25) {
        setSelectedEntityId(null);
      }

      selectedCircle.current.show();
      selectedCircle.current.setRadius(
        map.current.getScale(zoom) * 3,
      );
      selectedCircle.current.setCoordinates([
        selectedEntity.longitude,
        selectedEntity.latitude,
      ]);
    } else {
      selectedCircle.current.hide();
    }
  }, [
    selectedEntity,
    selectedCircle,
    zoom,
    map,
    selectedEntity,
    selectedTrack,
  ]);

  useEffect(() => {
    if (!map.current) return;
    const braaLayer = map.current.getLayer("braa") as maptalks.VectorLayer;
    const line = braaLayer.getGeometryById("braa-line") as maptalks.LineString;
    const text = braaLayer.getGeometryById("braa-text") as maptalks.Label;

    if (drawBraaStart && cursorPos) {
      let start = drawBraaStart;
      let end = cursorPos;
      if (typeof start !== "number" && typeof end !== "number") {
        let bearing = Math.round(getBearing(start, end)) +
          dcsMap.magDec;
        if (bearing > 360) {
          bearing = bearing - 360;
        } else if (bearing < 0) {
          bearing = bearing + 360;
        }
        line.setCoordinates([
          [start[1], start[0]],
          [end[1], end[0]],
        ]);

        const scale = map.current!.getScale(map.current!.getZoom());
        text.setCoordinates([end[1], end[0]]).translate(
          scale / 9000,
          0,
        );

        (text.setContent as any)(
          `${bearing}${getCardinal(bearing)} / ${
            Math.floor(
              computeDistanceBetween(start, end) * 0.00053995680345572,
            )
          }NM`,
        );

        text.show();
        line.show();
      }
    } else {
      text.hide();
      line.hide();
    }
  }, [drawBraaStart, cursorPos]);

  return (
    <div
      style={{
        display: "block",
        position: "absolute",
        top: 0,
        bottom: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "block",
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "100%",
          overflow: "hidden",
        }}
        ref={mapContainer}
      >
      </div>
      {selectedTrack && selectedEntity && map.current &&
        (
          <EntityInfo
            map={map.current}
            track={selectedTrack}
            entity={selectedEntity}
          />
        )}
      {map.current &&
        (
          <MapRadarTracks
            map={map.current}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          />
        )}
      {map.current && bullsEntity &&
        (
          <MapSimpleEntity
            map={map.current}
            entity={bullsEntity}
            size={32}
            strokeWidth={4}
          />
        )}
      {map.current && ships && ships.map((ship) => (
        <MapSimpleEntity
          map={map.current!}
          entity={ship}
          size={12}
          strokeWidth={8}
        />
      ))}
    </div>
  );
}
