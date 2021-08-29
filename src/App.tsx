import React from "react";
import { Map } from "./components/NewNewNewMap";
import { Syria } from "./dcs/maps/Syria";

function App() {
  return (
    <div
      className="bg-gray-700 max-w-full max-h-full w-full h-full"
    >
      <Map dcsMap={Syria} />
    </div>
  );
}

export default App;
