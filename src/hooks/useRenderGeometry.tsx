import Immutable from "immutable";
import * as maptalks from "maptalks";
import ms from "milsymbol";
import { useEffect } from "react";
import { iconCache } from "../components/MapEntity";
import {
  Geometry,
  geometryStore,
  MarkPoint,
  setSelectedGeometry,
  updateGeometrySafe,
  Zone,
} from "../stores/GeometryStore";

const markPointSIDC = "GHG-GPRN--";

function renderZone(layer: maptalks.VectorLayer, zone: Zone) {
  const collection = layer.getGeometryById(
    zone.id
  ) as maptalks.GeometryCollection;
  if (collection) {
    const [polygon, text] = collection.getGeometries() as [
      maptalks.Polygon,
      maptalks.Label
    ];

    polygon.setCoordinates(zone.points.map((it) => [it[1], it[0]]));
    text.setCoordinates([zone.points[0][1], zone.points[0][0]]);
    (text.setContent as any)(zone.name || `Zone #${zone.id}`);

    return;
  }

  const polygon = new maptalks.Polygon(
    zone.points.map((it) => [it[1], it[0]]),
    {
      draggable: false,
      visible: true,
      editable: true,
      symbol: {
        lineColor: "#FBBF24",
        lineWidth: 2,
        polygonFill: "#D97706",
        polygonOpacity: 0.1,
      },
    }
  );

  const text = new maptalks.Label(
    zone.name || `Zone #${zone.id}`,
    [zone.points[0][1], zone.points[0][0]],
    {
      draggable: false,
      visible: true,
      editable: false,
      boxStyle: {
        padding: [2, 2],
        horizontalAlignment: "left",
        verticalAlignment: "middle",
        symbol: {
          markerType: "square",
          markerFill: "#4B5563",
          markerFillOpacity: 0.5,
          markerLineOpacity: 0,
          textHorizontalAlignment: "right",
          textVerticalAlignment: "middle",
          textDx: 10,
        },
      },
      textSymbol: {
        textFaceName: '"microsoft yahei"',
        textFill: "#FBBF24",
        textSize: 12,
      },
    }
  );

  const col = new maptalks.GeometryCollection([polygon, text], {
    id: zone.id,
    draggable: false,
  });
  col.on("dblclick", (e) => {
    setSelectedGeometry(zone.id);
  });
  col.on("editend", (e) => {
    const coords = polygon.getCoordinates()[0];
    updateGeometrySafe(zone.id, {
      points: coords.map((it) => [it.y, it.x]),
    });
  });

  layer.addGeometry(col);
}

function renderMarkPoint(layer: maptalks.VectorLayer, markPoint: MarkPoint) {
  const collection = layer.getGeometryById(
    markPoint.id
  ) as maptalks.GeometryCollection;
  if (collection) {
    // This is maybe not the safest :)
    const [icon, text] = collection.getGeometries() as [
      maptalks.Marker,
      maptalks.Label
    ];

    icon.setCoordinates([markPoint.position[1], markPoint.position[0]]);
    text.setCoordinates([markPoint.position[1], markPoint.position[0]]);
    (text.setContent as any)(markPoint.name || `Mark #${markPoint.id}`);

    return;
  }

  const icon = new maptalks.Marker(
    [markPoint.position[1], markPoint.position[0]],
    {
      draggable: false,
      visible: true,
      editable: false,
      symbol: {
        markerFile: iconCache[markPointSIDC],
        markerDy: 10,
      },
    }
  );

  const text = new maptalks.Label(
    markPoint.name || `Mark #${markPoint.id}`,
    [markPoint.position[1], markPoint.position[0]],
    {
      draggable: false,
      visible: true,
      editable: false,
      boxStyle: {
        padding: [2, 2],
        horizontalAlignment: "left",
        verticalAlignment: "middle",
        symbol: {
          markerType: "square",
          markerFill: "#4B5563",
          markerFillOpacity: 0.5,
          markerLineOpacity: 0,
          textHorizontalAlignment: "right",
          textVerticalAlignment: "middle",
          textDx: 20,
        },
      },
      textSymbol: {
        textFaceName: '"microsoft yahei"',
        textFill: "#FBBF24",
        textSize: 12,
      },
    }
  );

  const col = new maptalks.GeometryCollection([icon, text], {
    id: markPoint.id,
    draggable: false,
  });
  col.on("dblclick", (e) => {
    setSelectedGeometry(markPoint.id);
  });
  col.on("dragend", (e) => {
    const pos = col.getFirstCoordinate();
    updateGeometrySafe(markPoint.id, {
      position: [pos.y, pos.x],
    });
  });

  layer.addGeometry(col);
}

function renderGeometry(
  map: maptalks.Map,
  geometry: Immutable.Map<number, Geometry>
) {
  const layer = map.getLayer("custom-geometry") as maptalks.VectorLayer;
  for (const geo of layer.getGeometries()) {
    if (!geometry.has((geo as any)._id as number)) {
      geo.remove();
    }
  }

  for (const geo of geometry.valueSeq()) {
    if (geo.type === "markpoint") {
      renderMarkPoint(layer, geo);
    } else if (geo.type === "zone") {
      renderZone(layer, geo);
    }
  }
}

export default function useRenderGeometry(map: maptalks.Map | null) {
  if (iconCache[markPointSIDC] === undefined) {
    iconCache[markPointSIDC] = new ms.Symbol(markPointSIDC, {
      size: 14,
      frame: false,
      fill: true,
      strokeWidth: 8,
      monoColor: "#FDE68A",
    }).toDataURL();
  }

  useEffect(() => {
    return geometryStore.subscribe(
      (geometry: Immutable.Map<number, Geometry>) => {
        if (map === null) return;
        renderGeometry(map, geometry);
      },
      (state) => state.geometry
    );
  }, [map]);

  useEffect(() => {
    if (map !== null) {
      renderGeometry(map, geometryStore.getState().geometry);
    }
  }, [map]);
}
