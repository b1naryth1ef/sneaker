import { serverStore } from "../stores/ServerStore";

export function DebugSettings() {
  const entities = serverStore((state) => state.entities);

  return (
    <div className="flex flex-col mt-auto gap-2 text-left">
      {entities.valueSeq().map((
        it,
      ) => (
        <div
          className="border border-gray-400 flex flex-col bg-gray-200 hover:bg-gray-300"
          key={it.id}
        >
          <div>{it.id}</div>
          <div>{it.name}</div>
          <div>{it.types.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}
