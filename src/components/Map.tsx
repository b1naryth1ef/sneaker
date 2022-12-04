import * as maptalks from "maptalks";
import ms from "milsymbol";
import React, {
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderToString } from "react-dom/server";
import { FONT_FAMILY } from "../Constants";
import { planes } from "../dcs/aircraft";
import { DCSMap } from "../dcs/maps/DCSMap";
import { useKeyPress } from "../hooks/useKeyPress";
import useRenderGeometry from "../hooks/useRenderGeometry";
import useRenderGroundUnit from "../hooks/useRenderGroundUnits";
import { alertStore } from "../stores/AlertStore";
import { serverStore, setSelectedEntityId } from "../stores/ServerStore";
import { settingsStore } from "../stores/SettingsStore";
import {
  estimatedAltitudeRate,
  estimatedSpeed,
  isTrackVisible,
  trackStore,
} from "../stores/TrackStore";
import {
  computeBRAA,
  getBearingMap,
  getCardinal,
  getFlyDistance,
} from "../util";
import { Console } from "./Console";
import { EntityInfo, iconCache, MapSimpleEntity } from "./MapEntity";
import MapGeometryInfo from "./MapGeometryInfo";
import { colorMode } from "./MapIcon";
import { MissionTimer } from "./MissionTimer";
import ScratchPad from "./ScratchPad";
import { Settings } from "./Settings";

const syncVisibility = (geo: maptalks.Geometry, value: boolean) => {
  const isVisible = geo.isVisible();
  if (!isVisible && value) {
    geo.show();
  } else if (isVisible && !value) {
    geo.hide();
  }
};

function pruneLayer(
  layer: maptalks.VectorLayer,
  keepFn: (geoId: number) => boolean
) {
  for (const geo of layer.getGeometries()) {
    if (!keepFn((geo as any)._id)) {
      geo.remove();
    }
  }
}

function MapRadarTracks({
  map,
  selectedEntityId,
}: {
  map: maptalks.Map;
  selectedEntityId: number | null;
}) {
  const radarTracks = trackStore((state) => state.tracks.entrySeq().toArray());
  const triggeredEntityIds = alertStore((state) =>
    state.triggeredEntities.keySeq().toSet()
  );

  useEffect(() => {
    const settings = settingsStore.getState();
    const entities = serverStore.getState().entities;
    const tracks = trackStore.getState().tracks;

    const vvLayer = map.getLayer("track-vv") as maptalks.VectorLayer;
    const trailLayer = map.getLayer("track-trails") as maptalks.VectorLayer;
    const iconLayer = map.getLayer("track-icons") as maptalks.VectorLayer;
    const nameLayer = map.getLayer("track-name") as maptalks.VectorLayer;
    const altLayer = map.getLayer("track-altitude") as maptalks.VectorLayer;
    const speedLayer = map.getLayer("track-speed") as maptalks.VectorLayer;
    const vertLayer = map.getLayer(
      "track-verticalvelo"
    ) as maptalks.VectorLayer;
    const alertLayer = map.getLayer(
      "track-alert-radius"
    ) as maptalks.VectorLayer;

    pruneLayer(vvLayer, (it) => tracks.has(it));
    pruneLayer(iconLayer, (it) => entities.has(it));
    pruneLayer(trailLayer, (it) => entities.has(it));
    pruneLayer(nameLayer, (it) => entities.has(it));
    pruneLayer(altLayer, (it) => entities.has(it));
    pruneLayer(speedLayer, (it) => entities.has(it));
    pruneLayer(vertLayer, (it) => entities.has(it));

    for (const geo of alertLayer.getGeometries()) {
      const geoA: any = geo;
      if (!geoA._id) continue;
      const [geoId, _] = (geoA._id as string).split("-");
      if (!entities.has(parseInt(geoId))) {
        geo.remove();
      }
    }

    for (const [entityId, track] of radarTracks) {
      const trackVisible = isTrackVisible(track);
      const entity = entities.get(entityId);
      if (!entity) {
        continue;
      }

      const trackOptions = trackStore.getState().trackOptions.get(entityId);

      const iconGeo = iconLayer.getGeometryById(entityId) as maptalks.Marker;
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
            id: entityId,
            draggable: false,
            visible: false,
            editable: false,
            symbol: {
              markerFile: iconCache[entity.sidc],
              markerDy: 10,
            },
          }
        );

        iconLayer.addGeometry(iconGeo);
        iconGeo.on("click", (e) => {
          setSelectedEntityId(entity.id);
          return false;
        });
      } else {
        iconGeo.setCoordinates([entity.longitude, entity.latitude]);
        syncVisibility(iconGeo, trackVisible);
      }

      const nameGeo = nameLayer.getGeometryById(entityId) as maptalks.Label;
      if (!nameGeo) {
        let name = entity.name;
        if (entity.pilot && !entity.pilot.startsWith(entity.group)) {
          name = `${entity.pilot} (${name})`;
        } else if (planes[entity.name]?.natoName !== undefined) {
          name = `${planes[entity.name].natoName} (${entity.name})`;
        }

        let color = entity.coalition !== "Allies" ? "#17c2f6" : "#ff8080";
        if (trackOptions?.watching) {
          color = "yellow";
        }

        const nameLabel = new maptalks.Label(name, [0, 0], {
          id: entityId,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            padding: [2, 2],
            horizontalAlignment: "left",
            symbol: {
              markerType: "square",
              markerFill: "#4B5563",
              markerFillOpacity: 0.5,
              markerLineColor: color,
              textHorizontalAlignment: "right",
              textDx: 20,
            },
          },
          textSymbol: {
            textFaceName: FONT_FAMILY,
            textFill: "white",
            textSize: 12,
          },
        });
        nameLabel.on("click", (e) => {
          setSelectedEntityId(entity.id);
          return false;
        });
        nameLayer.addGeometry(nameLabel);
      } else {
        const symbol = nameGeo.getSymbol();
        if (triggeredEntityIds.has(entity.id)) {
          if ((symbol as any).markerLineWidth !== 4) {
            nameGeo.setSymbol({
              ...symbol,
              markerLineWidth: 4,
            });
          }
        } else {
          if ((symbol as any).markerLineWidth !== 1) {
            nameGeo.setSymbol({
              ...symbol,
              markerLineWidth: 1,
            });
          }
        }

        let color = entity.coalition !== "Allies" ? "#17c2f6" : "#ff8080";
        if (trackOptions?.watching) {
          color = "yellow";
        }

        const style: any = nameGeo.getBoxStyle();
        if (style.symbol.markerLineColor !== color) {
          nameGeo.setBoxStyle({
            ...style,
            symbol: { ...style.symbol, markerLineColor: color },
          });
        }

        nameGeo.setCoordinates([entity.longitude, entity.latitude]);
        syncVisibility(nameGeo, trackVisible);
      }

      const altGeo = altLayer.getGeometryById(entityId) as maptalks.Label;
      if (!altGeo) {
        const altLabel = new maptalks.Label("", [0, 0], {
          id: entityId,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            padding: [2, 2],
            horizontalAlignment: "left",
            symbol: {
              markerType: "square",
              markerFillOpacity: 0,
              markerLineOpacity: 0,
              textHorizontalAlignment: "right",
              textDx: 20,
              textDy: 18,
            },
          },
          textSymbol: {
            textFaceName: FONT_FAMILY,
            textFill: "#FFC0CB",
            textSize: 12,
          },
        });
        altLayer.addGeometry(altLabel);
      } else {
        (altGeo.setContent as any)(
          `${((entity.altitude * 3.28084) / 1000)
            .toFixed(1)
            .toString()
            .padStart(3, "0")}`
        );
        altGeo.setCoordinates([entity.longitude, entity.latitude]);
        syncVisibility(altGeo, trackVisible);
      }

      const speedGeo = speedLayer.getGeometryById(entityId) as maptalks.Label;
      if (!speedGeo) {
        const speedLabel = new maptalks.Label("", [0, 0], {
          id: entityId,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            padding: [2, 2],
            horizontalAlignment: "left",
            symbol: {
              markerType: "square",
              markerFillOpacity: 0,
              markerLineOpacity: 0,
              textHorizontalAlignment: "right",
              textDx: 47,
              textDy: 18,
            },
          },
          textSymbol: {
            textFaceName: FONT_FAMILY,
            textFill: "orange",
            textSize: 12,
          },
        });
        speedLayer.addGeometry(speedLabel);
      } else {
        (speedGeo.setContent as any)(`${Math.round(estimatedSpeed(track))}`);
        speedGeo.setCoordinates([entity.longitude, entity.latitude]);

        syncVisibility(speedGeo, trackVisible);
      }

      const vertGeo = vertLayer.getGeometryById(entityId) as maptalks.Label;
      if (!vertGeo) {
        const vertLabel = new maptalks.Label("", [0, 0], {
          id: entityId,
          draggable: false,
          visible: false,
          editable: false,
          boxStyle: {
            padding: [2, 2],
            horizontalAlignment: "left",
            symbol: {
              markerType: "square",
              markerFillOpacity: 0,
              markerLineOpacity: 0,
              textHorizontalAlignment: "right",
              textDx: 72,
              textDy: 18,
            },
          },
          textSymbol: {
            textFaceName: FONT_FAMILY,
            textFill: "#6EE7B7",
            textSize: 12,
          },
        });
        vertLayer.addGeometry(vertLabel);
      } else {
        (vertGeo.setContent as any)(
          `${Math.round(estimatedAltitudeRate(track))}`
        );
        vertGeo.setCoordinates([entity.longitude, entity.latitude]);
        syncVisibility(vertGeo, trackVisible);
      }

      let threatCircle = alertLayer.getGeometryById(
        `${entityId}-threat`
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
        const threatRadius =
          trackOptions &&
          (trackOptions.threatRadius || trackOptions.profileThreatRadius);
        if (threatRadius) {
          threatCircle.setCoordinates([entity.longitude, entity.latitude]);
          threatCircle.setRadius(threatRadius * 1852);
          trackVisible ? threatCircle.show() : threatCircle.hide();
        } else {
          threatCircle.hide();
        }
      }

      let warningCircle = alertLayer.getGeometryById(
        `${entityId}-warning`
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
        const warningRadius =
          trackOptions &&
          (trackOptions.warningRadius || trackOptions.profileWarningRadius);
        syncVisibility(warningCircle, (warningRadius && trackVisible) || false);
        if (warningRadius) {
          warningCircle.setCoordinates([entity.longitude, entity.latitude]);
          warningCircle.setRadius(warningRadius * 1852);
        }
      }

      const trailLength = settings.map.trackTrailLength;
      if (trailLength !== undefined && trailLength > 0) {
        let trackPingGroup = trailLayer.getGeometryById(
          entityId
        ) as maptalks.GeometryCollection;
        if (!trackPingGroup) {
          trackPingGroup = new maptalks.GeometryCollection([], {
            id: entityId,
          });
          trailLayer.addGeometry(trackPingGroup);
        }

        let trackPointGeos =
          trackPingGroup.getGeometries() as Array<maptalks.Marker>;
        if (trackPointGeos.length !== settings.map.trackTrailLength) {
          trackPointGeos = [];

          for (let i = 0; i < trailLength; i++) {
            trackPointGeos.push(
              new maptalks.Marker([0, 0], {
                id: i,
                visible: false,
                editable: false,
                shadowBlur: 0,
                draggable: false,
                dragShadow: false,
                drawOnAxis: null,
                symbol: {},
              })
            );
          }
          trackPingGroup.setGeometries(trackPointGeos);
        }

        if (estimatedSpeed(track) < 25) {
          for (const trackGeo of trackPointGeos) {
            if (trackGeo.isVisible()) {
              trackGeo.hide();
            }
          }
        } else {
          for (
            let index = 0;
            index < track.length && index < trailLength;
            index++
          ) {
            const trackPoint = track[index];
            const trackPointGeo = trackPointGeos[index];
            syncVisibility(trackPointGeo, true);
            trackPointGeo.setCoordinates([
              trackPoint.position[1],
              trackPoint.position[0],
            ]);

            let color = "white";
            if (trackVisible) {
              color = entity.coalition !== "Allies" ? "#17c2f6" : "#ff8080";
            }

            trackPointGeo.setSymbol({
              markerType: "square",
              markerFill: color,
              markerLineColor: "black",
              markerLineOpacity: 0.1,
              markerLineWidth: 1,
              markerWidth: 5,
              markerHeight: 5,
              markerDx: 0,
              markerDy: 0,
              markerFillOpacity: (100 - index * 10) / 100,
            });
          }
        }
      }

      const speed = track && estimatedSpeed(track);
      const dirArrowEnd =
        speed &&
        track &&
        isTrackVisible(track) &&
        computeBRAA(
          track[0].position[0],
          track[0].position[1],
          track[0].heading,
          // knots -> meters per second -> 30 seconds
          speed * 0.514444 * 30
        );
      const geo = vvLayer.getGeometryById(
        entityId
      ) as maptalks.LineString | null;

      if (dirArrowEnd) {
        if (!geo) {
          vvLayer.addGeometry(
            new maptalks.LineString(
              [
                [track[0].position[1], track[0].position[0]],
                [dirArrowEnd[1], dirArrowEnd[0]],
              ],
              {
                id: entityId,
                arrowStyle: "classic",
                arrowPlacement: "vertex",
                symbol: {
                  lineColor:
                    entity.coalition !== "Allies" ? "#17c2f6" : "#ff8080",
                  lineWidth: 1.5,
                },
              }
            )
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
  }, [radarTracks, triggeredEntityIds]);

  useEffect(() => {
    const alertLayer = map.getLayer(
      "track-alert-radius"
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
            lineOpacity: 0.6,
          });
        }
      } else {
        if (typeName === "threat") {
          geo.setSymbol({
            lineColor: "red",
            lineWidth: 1,
            lineOpacity: 0.5,
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

  const [drawBraaStart, setDrawBraaStart] = useState<
    number | [number, number] | null
  >(null);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scratchPadOpen, setScratchPadOpen] = useState(false);

  const [entities, selectedEntity] = serverStore((state) => [
    state.entities,
    state.selectedEntityId && state.entities.get(state.selectedEntityId),
  ]);

  // TODO: server should set coalition
  const bullsEntity = entities.find(
    (it) => it.types.includes("Bullseye") && it.coalition === "Enemies"
  );
  const ships = useMemo(
    () => entities.filter((it) => it.types.includes("Sea")),
    [entities]
  );

  const selectedTrack = trackStore(
    (state) => selectedEntity && state.tracks.get(selectedEntity.id)
  );

  const isSnapPressed = useKeyPress("s");

  const settings = settingsStore();

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
        lineColor: "yellow",
        lineWidth: 2,
      },
    });

    var braaText = new maptalks.Label("", [0, 0], {
      id: "braa-text",
      draggable: false,
      visible: false,
      editable: false,
      boxStyle: {
        padding: [2, 2],
        verticalAlignment: "top",
        horizontalAlignment: "left",
        symbol: {
          markerType: "square",
          markerFill: "rgb(135,196,240)",
          markerFillOpacity: 0.9,
          markerLineColor: "#34495e",
          markerLineWidth: 1,
        },
      },
      textSymbol: {
        textFaceName: FONT_FAMILY,
        textFill: "white",
        textSize: 18,
        textVerticalAlignment: "top",
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
      position: "bottom-left",
      draggable: true,
      custom: false,
      content: renderToString(<div></div>),
    });

    map.current = new maptalks.Map(mapContainer.current, {
      hitDetect: false,
      panAnimation: false,
      dragRotate: false,
      dragPitch: false,
      touchZoom: true,
      touchRotate: false,
      doubleClickZoom: false,
      center: [dcsMap.center[1], dcsMap.center[0]],
      zoom: 8,
      seamlessZoom: true,
      fpsOnInteracting: 60,
      attribution: null,
      baseLayer: new maptalks.TileLayer("base", {
        urlTemplate:
          "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c"],
        maxCacheSize: 2048,
        hitDetect: false,
      }),
      layers: [
        new maptalks.VectorLayer("airports", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("farp-name", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("farp-icon", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("ground-units", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("custom-geometry", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("track-trails", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("track-vv", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("track-icons", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("track-name", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("track-alert-radius", [], {
          hitDetect: false,
          forceRenderOnZooming: true,
          forceRenderOnMoving: true,
          forceRenderOnRotating: true,
        }),
        new maptalks.VectorLayer("track-altitude", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("track-speed", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer("track-verticalvelo", [], {
          hitDetect: false,
        }),
        new maptalks.VectorLayer(
          "braa",
          [braaLine, braaText, selectedCircle.current],
          {
            hitDetect: false,
            forceRenderOnZooming: true,
            forceRenderOnMoving: true,
            forceRenderOnRotating: true,
          }
        ),
      ],
    } as any);

    map.current.addControl(entityInfoPanel.current);

    map.current.on("contextmenu", (e) => {});

    map.current.on("zooming", (e) => {
      setZoom(map.current!.getZoom());
    });

    map.current.on("mousemove", (e) => {
      setCursorPos([e.coordinate.y, e.coordinate.x]);
    });

    map.current.on("mouseup", (e) => {
      if (e.domEvent.button === 2) {
        setDrawBraaStart(null);
      }
    });
  }, [mapContainer, map]);

  useEffect(() => {
    if (!map.current) return;
    if (settings.map.trackTrailLength === 0) {
      map.current!.getLayer("track-trails").hide();
    } else {
      map.current!.getLayer("track-trails").show();
    }
    if (settings.map.showTrackIcons === false) {
      map.current!.getLayer("track-icons").hide();
    } else {
      map.current!.getLayer("track-icons").show();
    }
    if (settings.map.showTrackLabels === false) {
      map.current!.getLayer("track-name").hide();
    } else {
      map.current!.getLayer("track-name").show();
    }
  }, [map, settings]);

  // Configure airports
  useEffect(() => {
    if (!map.current) return;
    const layer = map.current.getLayer("airports") as maptalks.VectorLayer;
    const icon = new ms.Symbol("SUG-IBA----", {
      size: 14,
      frame: true,
      fillOpacity: 0.5,
      fill: true,
      colorMode: colorMode,
    }).toDataURL();

    for (const airport of dcsMap.airports) {
      const airportLabel = new maptalks.Label(
        `${airport.name}`,
        [airport.position[1], airport.position[0]],
        {
          draggable: false,
          visible: true,
          editable: false,
          boxStyle: {
            padding: [2, 2],
            horizontalAlignment: "left",
            symbol: {
              markerType: "square",
              markerFill: "black",
              markerFillOpacity: 0,
              markerLineWidth: 0,
              textHorizontalAlignment: "center",
              textDy: -25,
            },
          },
          textSymbol: {
            textFaceName: FONT_FAMILY,
            textFill: "white",
            textOpacity: 0.5,
            textSize: 10,
          },
        }
      );
      layer.addGeometry(airportLabel);

      const airportMarker = new maptalks.Marker(
        [airport.position[1], airport.position[0]],
        {
          symbol: {
            markerFile: icon,
          },
        }
      );
      layer.addGeometry(airportMarker);
    }
  }, [map]);

  const mouseDownHandlerRef: MutableRefObject<null | maptalks.EvenableHandlerFun> =
    useRef(null);

  useEffect(() => {
    if (!map.current) return;
    if (mouseDownHandlerRef.current) {
      map.current.removeEventListener("mousedown", mouseDownHandlerRef.current);
    }

    mouseDownHandlerRef.current = (e) => {
      if (!map.current) return;
      const nameLayer = map.current.getLayer("track-name");
      const customGeoLayer = map.current.getLayer("custom-geometry");
      const iconLayer = map.current.getLayer("track-icons");
      const airportsLayer = map.current.getLayer("airports");
      const farpNameLayer = map.current.getLayer("farp-name");
      const farpIconLayer = map.current.getLayer("farp-icon");

      if (e.domEvent.button === 2) {
        if (isSnapPressed) {
          map.current.identify(
            {
              coordinate: e.coordinate,
              layers: [
                nameLayer,
                iconLayer,
                airportsLayer,
                farpNameLayer,
                farpIconLayer,
                customGeoLayer,
              ],
            },
            (geos: Array<maptalks.Geometry>) => {
              if (geos.length >= 1) {
                const rawId = geos[0].getId();
                if (geos[0].options.entityId !== undefined) {
                  setDrawBraaStart(geos[0].options.entityId);
                } else if (typeof rawId === "string") {
                  setDrawBraaStart(parseInt(rawId));
                } else {
                  const coord = geos[0].getCenter();
                  setDrawBraaStart([coord.y, coord.x]);
                }
              }
            }
          );
        } else {
          setDrawBraaStart([e.coordinate.y, e.coordinate.x]);
        }
      }
    };
    map.current.on("mousedown", mouseDownHandlerRef.current);
  }, [map, isSnapPressed]);

  useEffect(() => {
    if (!selectedCircle.current || !map.current) return;

    if (selectedEntity && selectedTrack) {
      const speed = estimatedSpeed(selectedTrack);
      if (speed < 25) {
        setSelectedEntityId(null);
      }

      selectedCircle.current.show();
      selectedCircle.current.setRadius(map.current.getScale(zoom) * 3);
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
      let end = cursorPos;

      let start: [number, number];
      let entity;
      if (typeof drawBraaStart === "number") {
        entity = entities.get(drawBraaStart);
        if (!entity) {
          setDrawBraaStart(null);
          return;
        }

        start = [entity.latitude, entity.longitude];
      } else {
        start = drawBraaStart;
      }

      if (typeof start !== "number" && typeof end !== "number") {
        const bearing = getBearingMap(start, end, dcsMap);
        line.setCoordinates([
          [start[1], start[0]],
          [end[1], end[0]],
        ]);

        const scale = map.current!.getScale(map.current!.getZoom());
        text.setCoordinates([end[1], end[0]]).translate(scale / 9000, 0);

        (text.setContent as any)(
          `${bearing.toString().padStart(3, "0")}${getCardinal(
            bearing
          )} / ${Math.round(getFlyDistance(start, end))}`
        );

        text.show();
        line.show();
      }
    } else {
      text.hide();
      line.hide();
    }
  }, [
    drawBraaStart,
    cursorPos,
    typeof drawBraaStart === "number" && entities.get(drawBraaStart),
  ]);

  const currentCursorBulls = useMemo(() => {
    if (!bullsEntity || !cursorPos) return;
    const bearing = getBearingMap(
      [bullsEntity.latitude, bullsEntity.longitude],
      cursorPos,
      dcsMap
    );
    return `${bearing.toString().padStart(3, "0")}${getCardinal(
      bearing
    )} / ${Math.round(
      getFlyDistance(cursorPos, [bullsEntity.latitude, bullsEntity.longitude])
    )}`;
  }, [cursorPos, bullsEntity]);

  const farps = useMemo(
    () =>
      entities.filter(
        (it) => it.types.includes("Aerodrome") && it.coalition !== "Allies"
      ),
    [entities]
  );
  useEffect(() => {
    if (!map.current) return;
    const farpNameLayer = map.current.getLayer(
      "farp-name"
    ) as maptalks.VectorLayer;
    const farpIconLayer = map.current.getLayer(
      "farp-icon"
    ) as maptalks.VectorLayer;

    for (const farpGeo of farpNameLayer.getGeometries()) {
      if (!farps.has(farpGeo.id as number)) {
        farpGeo.remove();
      }
    }

    for (const farpGeo of farpIconLayer.getGeometries()) {
      if (!farps.has(farpGeo.id as number)) {
        farpGeo.remove();
      }
    }

    const icon = new ms.Symbol("10032000001120000000", {
      size: 14,
      frame: true,
      fillOpacity: 0.5,
      fill: true,
      colorMode: colorMode,
    }).toDataURL();

    for (const [_, farp] of farps) {
      let farpNameGeo = farpNameLayer.getGeometryById(
        farp.id
      ) as maptalks.Label;
      if (!farpNameGeo) {
        farpNameGeo = new maptalks.Label(
          `${farp.name}`,
          [farp.longitude, farp.latitude],
          {
            ...({
              entityId: farp.id,
            } as any),
            draggable: false,
            visible: true,
            editable: false,
            boxStyle: {
              padding: [2, 2],
              horizontalAlignment: "left",
              symbol: {
                markerType: "square",
                markerFill: "black",
                markerFillOpacity: 0,
                markerLineWidth: 0,
                textHorizontalAlignment: "center",
                textDy: -25,
              },
            },
            textSymbol: {
              textFaceName: FONT_FAMILY,
              textFill: "white",
              textOpacity: 0.5,
              textSize: 10,
            },
          }
        );
        farpNameLayer.addGeometry(farpNameGeo);
      } else {
        farpNameGeo.setCoordinates([farp.longitude, farp.latitude]);
      }

      let farpIconGeo = farpIconLayer.getGeometryById(
        farp.id
      ) as maptalks.Marker;
      if (!farpIconGeo) {
        farpIconGeo = new maptalks.Marker([farp.longitude, farp.latitude], {
          ...({
            entityId: farp.id,
          } as any),
          symbol: {
            markerFile: icon,
          },
        });
        farpIconLayer.addGeometry(farpIconGeo);
      } else {
        farpNameGeo.setCoordinates([farp.longitude, farp.latitude]);
      }
    }
  }, [farps]);

  useRenderGeometry(map.current);
  useRenderGroundUnit(map.current);

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
      ></div>
      {settingsOpen && <Settings close={() => setSettingsOpen(false)} />}
      {currentCursorBulls && (
        <div className="absolute right-0 bottom-0 max-w-xl max-h-32 text-yellow-600 text-3xl bg-gray-400 bg-opacity-20 p-1">
          {currentCursorBulls}
        </div>
      )}
      <MissionTimer />
      <div className="m-2 absolute left-0 top-14 md:top-0 flex flex-col gap-2">
        {selectedEntity && map.current && (
          <EntityInfo
            map={map.current}
            dcsMap={dcsMap}
            track={selectedTrack || null}
            entity={selectedEntity}
          />
        )}
        {map.current && <MapGeometryInfo map={map.current} />}
        {scratchPadOpen && (
          <ScratchPad close={() => setScratchPadOpen(false)} />
        )}
      </div>
      {map.current && (
        <Console
          setSettingsOpen={setSettingsOpen}
          setScratchPadOpen={setScratchPadOpen}
          map={map.current}
        />
      )}
      {map.current && (
        <MapRadarTracks
          map={map.current}
          selectedEntityId={selectedEntity ? selectedEntity.id : null}
        />
      )}
      {map.current && bullsEntity && (
        <MapSimpleEntity
          map={map.current}
          entity={bullsEntity}
          size={32}
          strokeWidth={4}
        />
      )}
      {map.current &&
        ships
          .valueSeq()
          .map((ship) => (
            <MapSimpleEntity
              key={ship.id}
              map={map.current!}
              entity={ship}
              size={12}
              strokeWidth={8}
            />
          ))}
    </div>
  );
}
