import classNames from "classnames";
import React, { useEffect } from "react";
import { BiLoader } from "react-icons/bi";
import { Link, Redirect, Route, Switch } from "react-router-dom";
import useFetch, { CachePolicies } from "use-http";
import { Map } from "./components/Map";
import { Caucasus } from "./dcs/maps/Caucasus";
import { DCSMap } from "./dcs/maps/DCSMap";
import { Marianas } from "./dcs/maps/Marianas";
import { PersianGulf } from "./dcs/maps/PersianGulf";
import { Sinai } from "./dcs/maps/Sinai";
import { Syria } from "./dcs/maps/Syria";
import { Falklands } from "./dcs/maps/Falklands";
import { Normandy } from "./dcs/maps/Normandy";
import { TheChannel } from "./dcs/maps/TheChannel";
import { Nevada } from "./dcs/maps/Nevada";
import { Server, serverStore } from "./stores/ServerStore";
import { route } from "./util";

type ServerMetadata = {
  name: string;
  players: Array<{ name: string; type: string }>;
};

function ServerOption({ server }: { server: ServerMetadata }) {
  return (
    <Link
      to={`/servers/${server.name}`}
      className="p-2 bg-gray-100 hover:bg-gray-200 border-gray-400 border rounded-sm shadow-sm w-full items-center flex flex-row"
    >
      <span className="text-3xl font-bold flex-grow">{server.name} </span>
      <span className="text-gray-600 text-sm font-light text-right">
        ({server.players.length} online)
      </span>
    </Link>
  );
}

function ServerConnectModal() {
  const {
    loading,
    error,
    data: servers,
    get,
  } = useFetch<Array<ServerMetadata>>(
    process.env.NODE_ENV === "production"
      ? `/api/servers`
      : `http://localhost:7789/api/servers`,
    []
  );

  return (
    <div
      className={classNames(
        "flex flex-col overflow-x-hidden overflow-y-auto absolute",
        "inset-0 z-50 bg-gray-100 mx-auto my-auto max-w-3xl",
        "border border-gray-200 rounded-sm shadow-md"
      )}
      style={{ maxHeight: "50%" }}
    >
      <div className="flex flex-row items-center p-2 border-b border-gray-400">
        <div className="text-2xl">Select Server</div>
      </div>
      <div className="flex flex-row p-2 h-full">
        {loading && (
          <BiLoader className="h-6 w-6 text-blue-400 animate-spin my-auto mx-auto" />
        )}
        {error && (
          <div>
            Something went wrong accessing the backend server. Please check your
            connection and <button onClick={() => get()}>try again</button>.
          </div>
        )}
        {servers && (
          <div className="flex flex-col gap-1 w-full">
            {servers.map((it) => (
              <ServerOption key={it.name} server={it} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServerContainer({ serverName }: { serverName: string }) {
  const [refLat, refLng] = serverStore((state) => {
    const globalObj = state.entities.get(0);
    if (!globalObj) return [undefined, undefined];
    return [
      globalObj.properties.ReferenceLatitude as number | undefined,
      globalObj.properties.ReferenceLongitude as number | undefined,
    ];
  });

  const {
    response,
    data: server,
    loading,
    error,
  } = useFetch<Server>(
    route(`/servers/${serverName}`),
    { cachePolicy: CachePolicies.NO_CACHE },
    [serverName]
  );

  useEffect(() => {
    if (server && !error && !loading) {
      serverStore.setState({ server: server });
      return () => serverStore.setState({ server: null });
    }
  }, [server, error, loading]);

  if (response.status === 404) {
    return <Redirect to="/" />;
  }

  if (error) {
    return (
      <div className="p-2 border border-red-400 bg-red-100 text-red-400">
        Error: {error.toString()}
      </div>
    );
  }

  if (loading || !refLat || !refLng) {
    return (
      <BiLoader className="h-6 w-6 text-blue-400 animate-spin my-auto mx-auto" />
    );
  }

  let dcsMap: DCSMap | null = null;
    console.log(refLat, refLng);
  if (refLat >= 38 && refLat <= 48 && refLng >= 26 && refLng <= 48) {
    dcsMap = Caucasus;
  } else if (refLat >= 25 && refLat < 34 && refLng >= 27 && refLng <= 37) {
    dcsMap = Sinai;
  } else if (refLat >= 28 && refLat < 38 && refLng >= 27 && refLng <= 42) {
    dcsMap = Syria;
  } else if (refLat >= 20 && refLat <= 33 && refLng >= 46 && refLng <= 64) {
    dcsMap = PersianGulf;
  } else if (refLat >= 7 && refLat <= 23 && refLng >= 136 && refLng <= 153) {
    dcsMap = Marianas;
  } else if (refLat >= -59 && refLat <= -45 && refLng >= -88 && refLng <= -38) {
    dcsMap = Falklands;
  } else if (refLat >= 48 && refLat <= 52 && refLng >= -4 && refLng <= 4) {
    dcsMap = Normandy;
  } else if (refLat >= 32 && refLat <= 40 && refLng >= -122 && refLng <= -112) {
    dcsMap = Nevada;
  } else {
    console.log(refLat, refLng);
    return (
      <div className="p-2 border border-red-400 bg-red-100 text-red-400">
        Failed to detect map. Please include the following in a bug report: (
        {refLat}, {refLng})
      </div>
    );
  }

  return <Map dcsMap={dcsMap} />;
}

function App() {
  return (
    <div className="bg-gray-700 max-w-full max-h-full w-full h-full">
      <Switch>
        <Route exact path="/" component={ServerConnectModal} />
        <Route
          exact
          path="/servers/:serverName"
          render={({
            match: {
              params: { serverName },
            },
          }) => {
            return <ServerContainer serverName={serverName} />;
          }}
        />
      </Switch>
    </div>
  );
}

export default App;
