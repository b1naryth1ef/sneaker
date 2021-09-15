import { throttle } from "lodash";
import { useEffect, useState } from "react";
import { BiX } from "react-icons/bi";

export default function ScratchPad({ close }: { close: () => void }) {
  const [contents, setContents] = useState(
    localStorage.getItem("scratchpad") || "",
  );

  useEffect(
    throttle(() => {
      localStorage.setItem("scratchpad", contents);
    }, 250),
    [contents],
  );

  return (
    <div
      className="w-full h-full flex flex-col border border-gray-300 rounded-sm"
    >
      <div
        className="bg-gray-300 p-0.5 text-sm flex flex-row items-center border-b border-gray-400"
      >
        <div>Scratch Pad</div>
        <button
          className="ml-auto flex flex-row items-center"
          onClick={close}
        >
          <BiX className="inline-block w-6 h-6 text-red-500" />
        </button>
      </div>
      <textarea
        className="form-textarea w-full h-full p-0.5"
        onChange={(e) => setContents(e.target.value)}
        value={contents}
      />
    </div>
  );
}
