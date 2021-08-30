import { getDistance } from "geolib";
import * as maptalks from "maptalks";
import React, {
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DCSMap } from "../dcs/maps/DCSMap";
import { serverStore } from "../stores/ServerStore";
import { estimatedSpeed, trackStore } from "../stores/TrackStore";
import { computeBRAA, getBearing, getCardinal } from "../util";
import { MapTrackedEntityInner } from "./MapEntity";

function Marker(
  { map, latitude, longitude, children, zoom }: {
    map: maptalks.Map;
    latitude: number;
    longitude: number;
    children?: React.ReactNode;
    zoom: number;
  },
) {
  const targetCoord = new maptalks.Coordinate(
    longitude,
    latitude,
  );

  const targetPosition = map.coordinateToContainerPoint(targetCoord).round();
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      style={{
        position: "absolute",
        top: targetPosition.y,
        left: targetPosition.x,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

function MapRadarTracks({ map, zoom }: { map: maptalks.Map; zoom: number }) {
  const radarTracks = trackStore((state) => state.tracks.entrySeq().toArray());
  useEffect(() => {
    const entities = serverStore.getState().entities;

    const layer = map.getLayer("tracks") as maptalks.VectorLayer;
    const trailLayer = map.getLayer("trails") as maptalks.VectorLayer;
    for (const geo of layer.getGeometries()) {
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

    for (const [entityId, track] of radarTracks) {
      const trackVisible = estimatedSpeed(track) >= 25;
      const entity = entities.get(entityId);
      if (!entity) {
        continue;
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
              "markerLineOpacity": 0,
              "markerLineDasharray": [],
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
      const geo = layer.getGeometryById(
        entityId,
      ) as (maptalks.LineString | null);

      if (dirArrowEnd) {
        if (!geo) {
          layer.addGeometry(
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
                "lineWidth": 1,
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

  const els = useMemo(
    () =>
      radarTracks.map(([entityId, track]) => {
        const entity = serverStore.getState().entities.get(entityId);
        if (!entity) {
          return <></>;
        }

        return (
          <Marker
            latitude={entity.latitude}
            longitude={entity.longitude}
            zoom={zoom}
            map={map}
            key={entityId}
          >
            <MapTrackedEntityInner
              entity={entity}
              active={false}
              track={track}
              hideLabel={false}
            />
          </Marker>
        );
      }),
    [radarTracks],
  );

  return <>{els}</>;
}

export function Map({ dcsMap }: { dcsMap: DCSMap }) {
  const mapContainer: MutableRefObject<HTMLDivElement | null> = useRef(null);
  const map: MutableRefObject<maptalks.Map | null> = useRef(null);
  const [zoom, setZoom] = useState<number>(8);

  const [drawBraaStart, setDrawBraaStart] = useState<
    [number, number] | null
  >(null);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(
    null,
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

    var point = new maptalks.Marker(
      [0, 0],
      {
        id: "braa-text",
        visible: false,
        editable: false,
        shadowBlur: 0,
        shadowColor: "black",
        draggable: false,
        dragShadow: false,
        drawOnAxis: null,
        symbol: {},
      },
    );

    map.current = new maptalks.Map(mapContainer.current, {
      layerCanvasLimitOnInteracting: true,
      hitDetect: false,
      panAnimation: false,
      dragRotate: false,
      dragPitch: false,
      touchZoom: false,
      doubleClickZoom: false,
      center: [dcsMap.center[1], dcsMap.center[0]],
      zoom: 8,
      seamlessZoom: true,
      baseLayer: new maptalks.TileLayer("base", {
        urlTemplate:
          "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c"],
      }),
      layers: [
        new maptalks.VectorLayer("braa", [braaLine, point], {
          zindex: 50,
        }),
        new maptalks.VectorLayer("tracks", [], { zindex: 10 }),
        new maptalks.VectorLayer("trails", [], { zindex: -10 }),
      ],
    } as any);

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
    if (!map.current) return;
    const braaLayer = map.current.getLayer("braa") as maptalks.VectorLayer;
    const line = braaLayer.getGeometryById("braa-line") as maptalks.LineString;
    const text = braaLayer.getGeometryById("braa-text") as maptalks.Marker;

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
        text.setCoordinates([end[1], end[0]]);
        text.setSymbol({
          "textPlacement": "line",
          "textFaceName": '"microsoft yahei"',
          "textName": `${bearing}${getCardinal(bearing)} / ${
            Math.floor(
              getDistance(start, end) * 0.00053995680345572,
            )
          }NM`,
          "textFill": "#A5B4FC",
          "textHorizontalAlignment": "right",
          "textSize": 14,
          "textDx": 15,
          "textHaloFill": "white",
        });

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
      {map.current && <MapRadarTracks map={map.current} zoom={zoom} />}
    </div>
  );
}
