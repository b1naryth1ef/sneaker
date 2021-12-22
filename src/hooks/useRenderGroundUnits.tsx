import Immutable from "immutable";
import * as maptalks from "maptalks";
import ms from "milsymbol";
import { useEffect } from "react";
import GroundUnitData from "../data/units/ground.json";
import {
  Server,
  serverStore,
  setSelectedEntityId,
} from "../stores/ServerStore";
import { GroundUnitMode, settingsStore } from "../stores/SettingsStore";
import {
  Entity,
  getCoalitionColor,
  getCoalitionIdentity,
} from "../types/entity";

type UnitData = {
  code: string;
  dcs_codes: Array<string>;
  mil_std_2525_d: number;
  name: string;
  sidc?: string;
};

export const groundIconCache: Record<string, string> = {};
export const groundUnitData = Immutable.Map(
  GroundUnitData.map((it) => [it.dcs_codes[0], it] as [string, UnitData])
);

function renderGroundUnit(layer: maptalks.VectorLayer, unit: Entity) {
  const collection = layer.getGeometryById(
    unit.id
  ) as maptalks.GeometryCollection;
  if (collection) {
    return;
  }

  const unitData = groundUnitData.get(unit.name);
  let sidc;
  if (unitData && unitData.sidc) {
    sidc = `${unitData.sidc[0]}${getCoalitionIdentity(
      unit.coalition
    )}${unitData.sidc.slice(2)}`;
  } else {
    sidc = `S${getCoalitionIdentity(unit.coalition)}G-E-----`;
  }

  if (sidc && !groundIconCache[sidc]) {
    groundIconCache[sidc] = new ms.Symbol(sidc, {
      size: 32,
      frame: true,
      fill: true,
      strokeWidth: 8,
      monoColor: getCoalitionColor(unit.coalition),
    }).toDataURL();
  }

  const icon = new maptalks.Marker([unit.longitude, unit.latitude], {
    draggable: false,
    visible: true,
    editable: false,
    symbol: {
      markerFile: sidc && groundIconCache[sidc],
      markerDy: 10,
      markerWidth: {
        stops: [
          [8, 12],
          [10, 24],
          [12, 36],
          [14, 48],
        ],
      },
      markerHeight: {
        stops: [
          [8, 12],
          [10, 24],
          [12, 36],
          [14, 48],
        ],
      },
    },
  });

  const col = new maptalks.GeometryCollection([icon], {
    id: unit.id,
    draggable: false,
  });
  col.on("click", (e) => {
    setSelectedEntityId(unit.id);
  });

  layer.addGeometry(col);
}

function renderGroundUnits(
  map: maptalks.Map,
  [entities, offset, server]: [
    Immutable.Map<number, Entity>,
    number,
    Server | null
  ],
  [_x, lastOffset, _y]: [unknown, number, unknown]
) {
  const layer = map.getLayer("ground-units") as maptalks.VectorLayer;
  const groundUnitMode = settingsStore.getState().map.groundUnitMode;

  const isVisible = (target: Entity) => {
    if (
      !groundUnitMode ||
      !server?.ground_unit_modes.includes(groundUnitMode)
    ) {
      return false;
    }

    if (groundUnitMode === GroundUnitMode.FRIENDLY) {
      return target.coalition === "Enemies";
    } else if (groundUnitMode === GroundUnitMode.ENEMY) {
      return target.coalition === "Allies" || target.coalition === "Enemies";
    }
    return false;
  };

  for (const geo of layer.getGeometries()) {
    const entity = entities.get((geo as any)._id as number);
    if (!entity || !isVisible(entity)) {
      geo.remove();
    }
  }

  for (const entity of entities.valueSeq()) {
    if (
      isVisible(entity) &&
      (lastOffset === 0 || entity.updatedAt > lastOffset)
    ) {
      renderGroundUnit(layer, entity);
    }
  }

  lastOffset = offset;
}

export default function useRenderGroundUnit(map: maptalks.Map | null) {
  const [groundUnitMode] = settingsStore((state) => [state.map.groundUnitMode]);

  useEffect(() => {
    if (!map) return;
    const { entities, offset, server } = serverStore.getState();
    if (!server) return;
    renderGroundUnits(
      map,
      [
        entities.filter(
          (it) =>
            it.types.includes("Ground") &&
            !it.types.includes("Air") &&
            !it.types.includes("Static")
        ),
        offset,
        server,
      ],
      [null, 0, null]
    );
  }, [map, groundUnitMode]);

  useEffect(() => {
    if (!map) return;

    return serverStore.subscribe(
      (a: [Immutable.Map<number, Entity>, number, Server | null], b) =>
        renderGroundUnits(map, a, b),
      (state) =>
        [
          state.entities.filter(
            (it) =>
              it.types.includes("Ground") &&
              !it.types.includes("Air") &&
              !it.types.includes("Static")
          ),
          state.offset,
          state.server,
        ] as [Immutable.Map<number, Entity>, number, Server | null]
    );
  }, [map]);
}
