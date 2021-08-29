import * as React from "react";
import { useMemo, useState } from "react";
import ReactMapGL, { Layer, Marker, Source } from "react-map-gl";
import { DCSMap } from "../dcs/maps/DCSMap";
import { useKeyPress } from "../hooks/useKeyPress";
import { serverStore } from "../stores/ServerStore";
import { estimatedSpeed, trackStore } from "../stores/TrackStore";
import { computeBRAA } from "../util";
import { MapTrackedEntityInner } from "./MapEntity";

const token =
  "pk.eyJ1IjoiYjFuYXJ5dGgxZWYiLCJhIjoiY2tzd3hwMWRwMjUwZjJvcG9vZXdyNTF5MSJ9.erhqQ4QHjdTfJ-vl9SQNsQ";

export function NewMap({ dcsMap }: { dcsMap: DCSMap }) {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    latitude: dcsMap.center[0],
    longitude: dcsMap.center[1],
    zoom: 7,
    mapboxApiAccessToken: token,
  });

  const [drawBraaStart, setDrawBraaStart] = useState<
    number | [number, number] | null
  >(null);
  const [cursorPos, setCursorPos] = useState<number | [number, number] | null>(
    null,
  );
  const isSnapDown = useKeyPress("s");

  const radarTracks = trackStore((state) => state.tracks.entrySeq().toArray());

  // todo: unfuck this lmao
  const radarTrackedVelocityLines: Array<
    [[number, number, number], [number, number, number]]
  > = useMemo(() =>
    radarTracks.map(([entityId, track]) => {
      const entity = serverStore.getState().entities.get(entityId);
      if (
        !entity || !entity.types.includes("Air") ||
        entity.types.includes("Parachutist")
      ) {
        return null;
      }

      const speed = estimatedSpeed(track);
      const dirArrowEnd = speed >= 15 && track.length >= 5 &&
        computeBRAA(
          entity.latitude,
          entity.longitude,
          entity.heading,
          // knots -> meters per second -> 30 seconds
          ((speed * 0.514444)) * 30,
        );

      if (dirArrowEnd) {
        return [
          [entity.longitude, entity.latitude, entity.altitude],
          [dirArrowEnd[1], dirArrowEnd[0], entity.altitude],
        ];
      }

      return null;
    }).filter((it) => it !== null) as Array<
      [[number, number, number], [number, number, number]]
    >, [radarTracks]);

  const radarTrackMarkers = useMemo(() => {
    return radarTracks.map(([entityId, track]) => {
      const entity = serverStore.getState().entities.get(entityId);
      if (
        !entity || !entity.types.includes("Air") ||
        entity.types.includes("Parachutist")
      ) {
        return null;
      }

      return (
        <>
          <Marker
            key={entityId}
            latitude={entity.latitude}
            longitude={entity.longitude}
          >
            <MapTrackedEntityInner
              entity={entity}
              active={false}
              track={track}
              hideLabel={false}
            />
          </Marker>
          {track.length >= 5 && track.map((
            ping,
            idx,
          ) => (
            <Marker
              key={ping.time}
              latitude={ping.position[0]}
              longitude={ping.position[1]}
              className={`bg-gray-100 bg-opacity-${100 -
                (idx * 10)} h-1 w-1 z-20`}
            >
            </Marker>
          ))}
        </>
      );
    }).filter((it) => it !== null);
  }, [radarTracks]);

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: radarTrackedVelocityLines.map((coords) => {
        return {
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
        };
      }),
    };
  }, [radarTrackedVelocityLines]);

  const braaGeo = useMemo(() => {
    if (drawBraaStart && cursorPos) {
      let start = drawBraaStart;
      let end = cursorPos;
      if (typeof start !== "number" && typeof end !== "number") {
        return {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [start[1], start[0]],
                [end[1], end[0]],
              ],
            },
          }],
        };
      }
    }
  }, [drawBraaStart, cursorPos]);

  return (
    <ReactMapGL
      style={{
        display: "block",
        position: "absolute",
        top: 0,
        bottom: 0,
        width: "100%",
      }}
      asyncRender={true}
      mapStyle="mapbox://styles/b1naryth1ef/ckswygbwt4jbg17s35bbq4du3"
      {...viewport}
      dragRotate={false}
      onViewportChange={(nextViewport: typeof viewport) =>
        setViewport(nextViewport)}
      onMouseDown={(e) => {
        const event = e.srcEvent as MouseEvent;
        if (event.button === 2) {
          if (isSnapDown) {
            // const snappedObject = entities.sort((
            //   a,
            //   b,
            // ) =>
            //   getDistance([a.latitude, a.longitude], [
            //     e.latlng.lat,
            //     e.latlng.lng,
            //   ]) - getDistance([b.latitude, b.longitude], [
            //     e.latlng.lat,
            //     e.latlng.lng,
            //   ])
            // ).first();
            // if (snappedObject) {
            //   setBraaStartPos(snappedObject.id);
            // }
          } else {
            setDrawBraaStart([e.lngLat[1], e.lngLat[0]]);
          }
        }
      }}
      onMouseUp={(e) => {
        const event = e.srcEvent as MouseEvent;
        if (event.button === 2) {
          setDrawBraaStart(null);
        }
      }}
      onMouseMove={(e) => {
        setCursorPos([e.lngLat[1], e.lngLat[0]]);
      }}
    >
      <Source id="my-data" type="geojson" data={geojson as any}>
        <Layer
          id="velocity-vectors"
          type="line"
          source="route"
          layout={{
            "line-join": "round",
            "line-cap": "round",
          }}
          paint={{
            "line-color": "#17c2f6",
            "line-width": 2,
          }}
        />
      </Source>
      <Source id="braa" type="geojson" data={braaGeo as any}>
        <Layer
          id="braa"
          type="line"
          source="route"
          layout={{
            "line-join": "round",
            "line-cap": "round",
          }}
          paint={{
            "line-color": "yellow",
            "line-width": 2,
          }}
        />
      </Source>
      {radarTrackMarkers}
    </ReactMapGL>
  );
}
