import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { getDistance } from "geolib";
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
// import "mapbox-gl/dist/mapbox-gl.css";
import React, {
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { DCSMap } from "../dcs/maps/DCSMap";
import { useKeyPress } from "../hooks/useKeyPress";
import { serverStore } from "../stores/ServerStore";
import { trackStore } from "../stores/TrackStore";
import { getBearing, getCardinal } from "../util";
import { MapTrackedEntityInner } from "./MapEntity";

mapboxgl.accessToken =
  "pk.eyJ1IjoiYjFuYXJ5dGgxZWYiLCJhIjoiY2tzd3hwMWRwMjUwZjJvcG9vZXdyNTF5MSJ9.erhqQ4QHjdTfJ-vl9SQNsQ";

function Marker(
  { map, longitude, latitude, children, offset, className }: {
    map: mapboxgl.Map;
    longitude: number;
    latitude: number;
    children?: React.ReactNode;
    offset?: mapboxgl.PointLike;
    className?: string;
  },
) {
  const marker: MutableRefObject<mapboxgl.Marker | null> = useRef(null);
  const markerContainer = useRef(document.createElement("div"));

  useEffect(() => {
    if (markerContainer.current === null || marker.current !== null) return;
    // markerContainer.current.className =
    //   `flex flex-row absolute w-80 z-40 ${className || ""}`;

    marker.current = new mapboxgl.Marker(markerContainer.current!).setLngLat([
      longitude,
      latitude,
    ]).addTo(map);

    return () => {
      marker.current && marker.current.remove();
    };
  }, []);

  useEffect(() => {
    if (!marker.current) return;
    marker.current.setLngLat([longitude, latitude]).setOffset(offset || [0, 0]);
  }, [longitude, latitude]);

  useEffect(() => {
    ReactDOM.render(<>{children}</>, markerContainer.current);
  }, [children]);

  return <></>;
}

export function NewNewMap({ dcsMap }: { dcsMap: DCSMap }) {
  const mapContainer = useRef(null);
  const map: MutableRefObject<mapboxgl.Map | null> = useRef<mapboxgl.Map>(null);
  const [lat, setLat] = useState(dcsMap.center[0]);
  const [lng, setLng] = useState(dcsMap.center[1]);
  const [zoom, setZoom] = useState(7);

  const [drawBraaStart, setDrawBraaStart] = useState<
    number | [number, number] | null
  >(null);
  const [cursorPos, setCursorPos] = useState<number | [number, number] | null>(
    null,
  );
  const isSnapDown = useKeyPress("s");
  const radarTracks = trackStore((state) => state.tracks.entrySeq().toArray());

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
            map={map.current!}
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
              map={map.current!}
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

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/b1naryth1ef/ckswygbwt4jbg17s35bbq4du3",
      center: [lng, lat],
      zoom: zoom,
      dragRotate: false,
    });

    map.current.on("load", (e) => {
      map.current!.addSource("braa", {
        "type": "geojson",
        "data": {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": [],
          },
        },
      });

      map.current!.addLayer({
        id: "braa",
        type: "line",
        source: "braa",
        "paint": {
          "line-color": "yellow",
          "line-width": 2,
        },
        "layout": {
          "line-join": "round",
          "line-cap": "round",
        },
      });

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        // Select which mapbox-gl-draw control buttons to add to the map.
        controls: {
          polygon: true,
          trash: true,
        },
        // Set mapbox-gl-draw to draw by default.
        // The user does not have to click the polygon control button first.
        defaultMode: "draw_polygon",
      });
      map.current!.addControl(draw);
    });

    map.current.on("move", () => {
      if (!map.current) return;
      setLng(map.current.getCenter().lng);
      setLat(map.current.getCenter().lat);
      setZoom(map.current.getZoom());
    });

    // map.current.on("mousemove", (e) => {
    //   // setCursorPos([e.lngLat.lat, e.lngLat.lng]);
    //   e.originalEvent.preventDefault()
    // });

    map.current.on("contextmenu", () => {
    });

    map.current.on("mousedown", (e) => {
      if (e.originalEvent.button === 2) {
        setDrawBraaStart([e.lngLat.lat, e.lngLat.lng]);
      }
    });

    map.current.on("mouseup", (e) => {
      if (e.originalEvent.button === 2) {
        setDrawBraaStart(null);
      }
    });
  }, []);

  useEffect(() => {
    const source = map.current!.getSource("braa") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    if (drawBraaStart && cursorPos) {
      let start = drawBraaStart;
      let end = cursorPos;
      if (typeof start !== "number" && typeof end !== "number") {
        source.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [start[1], start[0]],
                [end[1], end[0]],
              ],
            },
          }],
        });
      }
    } else {
      source.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        }],
      });
    }
  }, [drawBraaStart, cursorPos]);

  let bearing = useMemo(() => {
    if (!Array.isArray(drawBraaStart) || !Array.isArray(cursorPos)) {
      return;
    }

    const bearing = Math.round(getBearing(drawBraaStart, cursorPos)) +
      dcsMap.magDec;
    if (bearing > 360) {
      return bearing - 360;
    } else if (bearing < 0) {
      return bearing + 360;
    }
    return bearing;
  }, [drawBraaStart, cursorPos]);

  let cursorCoord;
  let drawBraaCoord;

  if (typeof drawBraaStart === "number") {
  } else {
    drawBraaCoord = drawBraaStart;
  }

  if (typeof cursorPos === "number") {
  } else {
    cursorCoord = cursorPos;
  }

  return (
    <div>
      <div
        style={{
          display: "block",
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "100%",
        }}
        ref={mapContainer}
        className="map-container"
      />
      {map.current && cursorCoord && bearing !== undefined && drawBraaCoord &&
        (
          <Marker
            map={map.current}
            latitude={cursorCoord[0]}
            longitude={cursorCoord[1]}
            offset={[-32, -32]}
          >
            <div
              className="absolute text-indigo-300 ml-10 text-xl whitespace-nowrap bg-gray-600 p-2"
            >
              {bearing}
              {getCardinal(bearing)} / {Math.floor(
                getDistance(
                  drawBraaCoord,
                  cursorCoord,
                ) *
                  0.00053995680345572,
              )}NM
            </div>
          </Marker>
        )}
      {radarTrackMarkers}
    </div>
  );
}
