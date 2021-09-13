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
  updateGeometry,
} from "../stores/GeometryStore";

const markPointSIDC = "GHG-GPRN--";

function renderMarkPoint(layer: maptalks.VectorLayer, markPoint: MarkPoint) {
  const collection = layer.getGeometryById(
    markPoint.id,
  ) as maptalks.GeometryCollection;
  if (collection) {
    // This is maybe not the safest :)
    const [icon, text] = collection.getGeometries() as [
      maptalks.Marker,
      maptalks.Label,
    ];

    icon.setCoordinates([
      markPoint.position[1],
      markPoint.position[0],
    ]);
    text.setCoordinates([
      markPoint.position[1],
      markPoint.position[0],
    ]);
    (text.setContent as any)(markPoint.name || `Mark #${markPoint.id}`);

    return;
  }

  const icon = new maptalks.Marker([
    markPoint.position[1],
    markPoint.position[0],
  ], {
    draggable: false,
    visible: true,
    editable: false,
    symbol: {
      markerFile: iconCache[markPointSIDC],
      markerDy: 10,
    },
  });

  const text = new maptalks.Label(markPoint.name || `Mark #${markPoint.id}`, [
    markPoint.position[1],
    markPoint.position[0],
  ], {
    draggable: false,
    visible: true,
    editable: false,
    boxStyle: {
      "padding": [2, 2],
      "horizontalAlignment": "left",
      "verticalAlignment": "middle",
      "symbol": {
        "markerType": "square",
        "markerFill": "#4B5563",
        "markerFillOpacity": 0.5,
        "markerLineOpacity": 0,
        textHorizontalAlignment: "right",
        textVerticalAlignment: "middle",
        textDx: 20,
      },
    },
    "textSymbol": {
      "textFaceName": '"microsoft yahei"',
      "textFill": "#FBBF24",
      "textSize": 12,
    },
  });

  const col = new maptalks.GeometryCollection([icon, text], {
    id: markPoint.id,
    draggable: false,
  });
  col.on("click", (e) => {
    setSelectedGeometry(markPoint.id);
  });
  col.on("dragend", (e) => {
    const pos = col.getFirstCoordinate();
    updateGeometry({
      ...markPoint,
      position: [pos.y, pos.x],
    });
  });

  layer.addGeometry(col);
}

function renderGeometry(
  map: maptalks.Map,
  geometry: Immutable.Map<number, Geometry>,
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
    }
  }
}

export default function useRenderGeometry(
  map: maptalks.Map | null,
) {
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
      (state) => state.geometry,
    );
  }, [map]);

  // TODO: use for editing mode
  // useEffect(() => {
  //   return geometryStore.subscribe(
  //     (selectedGeometry: number | null, previous: number | null) => {
  //       if (map === null || selectedGeometry === null) return;
  //       const layer = (map.getLayer("custom-geometry") as maptalks.VectorLayer);
  //       if (previous !== null) {
  //         const prevItem = layer.getGeometryById(
  //           previous,
  //         ) as maptalks.GeometryCollection;
  //         // prevItem.getGeometries()[0].setOptions({
  //         //   ...prevItem.getGeometries()[0].options,
  //         //   draggable: false,
  //         // });
  //         prevItem.setOptions({ ...prevItem.options, draggable: false });
  //         // TODO: copy in geometry
  //       }

  //       const nextItem = layer.getGeometryById(
  //         selectedGeometry,
  //       ) as maptalks.GeometryCollection;
  //       nextItem.setOptions({ ...nextItem.options, draggable: true });
  //       // nextItem.startEdit();
  //       // console.log("draggable!", nextItem.getGeometries()[0]);
  //       // nextItem.getGeometries()[0].setOptions({
  //       //   ...nextItem.getGeometries()[0].options,
  //       //   draggable: true,
  //       // });
  //     },
  //     (state) => state.selectedGeometry,
  //   );
  // });

  useEffect(() => {
    if (map !== null) {
      renderGeometry(map, geometryStore.getState().geometry);
    }
  }, [map]);
}
