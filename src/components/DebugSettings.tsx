import classNames from "classnames";
import { useMemo, useState } from "react";
import { serverStore } from "../stores/ServerStore";
import { Entity } from "../types/entity";
import DetailedCoords from "./DetailedCoords";

function DebugEntity(
  { entity, selected, setSelected }: {
    entity: Entity;
    selected: boolean;
    setSelected: (v: number | null) => void;
  },
) {
  return (
    <div
      className="flex flex-col border border-gray-400"
      onClick={() => setSelected(entity.id)}
    >
      <div
        className={classNames("bg-gray-200 p-0.5", {
          "hover:bg-gray-300 cursor-pointer": !selected,
        })}
      >
        <div>{entity.id} / {entity.name}</div>
        <div>{entity.coalition}</div>
        <div>{entity.types.join(", ")}</div>
      </div>
      {selected && (
        <div className="flex flex-col p-0.5 mt-1">
          <DetailedCoords coords={[entity.latitude, entity.longitude]} />
        </div>
      )}
    </div>
  );
}

export function DebugSettings() {
  const entities = serverStore((state) => state.entities);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedEntities = useMemo(() => {
    return entities.filter((it) =>
      (it.name &&
        it.name.toLowerCase().includes(search.toLowerCase())) ||
      it.id.toString() === search ||
      it.types.map((it) => it.toLowerCase()).includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="flex flex-col mt-auto gap-2 text-left">
      <input
        className="form-input mt-1 block w-full p-1 flex-grow"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {selectedEntities.valueSeq().map((
        it,
      ) =>
        (
          <DebugEntity
            entity={it}
            key={it.id}
            selected={selectedId === it.id}
            setSelected={setSelectedId}
          />
        )
      )}
    </div>
  );
}
