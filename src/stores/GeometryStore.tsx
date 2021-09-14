import Immutable from "immutable";
import create from "zustand";

export type GeometryBase = {
  id: number;
  name?: string;
};

export type MarkPoint = {
  type: "markpoint";
  position: [number, number];
} & GeometryBase;

export type Zone = {
  type: "zone";
  points: Array<[number, number]>;
} & GeometryBase;

export type Geometry = (MarkPoint | Zone);

type GeometryStoreData = {
  geometry: Immutable.Map<number, Geometry>;
  id: number;
  selectedGeometry: number | null;
};

export const geometryStore = create<GeometryStoreData>(() => {
  return {
    geometry: Immutable.Map<number, Geometry>(),
    id: 0,
    selectedGeometry: null,
  };
});

export function deleteGeometry(id: number) {
  geometryStore.setState((state) => {
    return { ...state, geometry: state.geometry.remove(id) };
  });
}

export function updateGeometry(value: Geometry) {
  geometryStore.setState((state) => {
    return { ...state, geometry: state.geometry.set(value.id, value) };
  });
}

export function setSelectedGeometry(id: number | null) {
  geometryStore.setState({ selectedGeometry: id });
}

export function addZone(points: Array<[number, number]>) {
  geometryStore.setState((state) => {
    return {
      ...state,
      id: state.id + 1,
      geometry: state.geometry.set(state.id, {
        id: state.id,
        type: "zone",
        points,
      }),
    };
  });
}

export function addMarkPoint(position: [number, number]) {
  geometryStore.setState((state) => {
    return {
      ...state,
      id: state.id + 1,
      geometry: state.geometry.set(state.id, {
        id: state.id,
        type: "markpoint",
        position,
      }),
    };
  });
}
