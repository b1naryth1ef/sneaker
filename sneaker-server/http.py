import asyncio
import json
import time

from aiohttp import web
from aiohttp.web_response import Response
from aiohttp_sse import sse_response

from .tacview_client import TacViewClient, TacViewObject


def chunks(data, n):
    n = max(1, n)
    return (data[i : i + n] for i in range(0, len(data), n))


class TacViewObserver:
    def __init__(self, app):
        self._app = app
        self._client = self._app["tacview"]
        self._client.state._on_frame = self.on_frame
        self._updated_objects = set()
        self._deleted_objects = set()
        self._last_dispatch = None

    async def on_frame(self, frame):
        self._updated_objects |= frame.updated_objects
        self._deleted_objects |= frame.updated_objects

        if not self._last_dispatch or time.time() - self._last_dispatch > 2:
            await self.dispatch()

    async def dispatch(self):
        offset = None
        global_obj = self._client.state.objects.get(0)
        if not global_obj:
            print("Missing global obj, cannot dispatch data")
            return

        if "ReferenceLongitude" in global_obj.properties:
            offset = [
                float(global_obj.properties["ReferenceLatitude"]),
                float(global_obj.properties["ReferenceLongitude"]),
            ]

        self._last_dispatch = time.time()
        events = []
        for object_id in self._updated_objects:
            obj: TacViewObject = self._client.state.objects.get(object_id)
            if not obj:
                continue

            if "Air" not in obj.types and "Sea" not in obj.types:
                continue

            events.append(obj.serialize(offset))

        for sub in self._app["subscribers"]:
            await sub.put(json.dumps(events))


async def stream_events(request):
    queue = asyncio.Queue(32)
    app["subscribers"].append(queue)
    try:
        async with sse_response(
            request, headers={"Access-Control-Allow-Origin": "*"}
        ) as resp:
            offset = None
            global_obj = app["tacview"].state.objects.get(0)
            if not global_obj:
                raise Exception("Failed to find global object")

            if "ReferenceLongitude" in global_obj.properties:
                offset = [
                    float(global_obj.properties["ReferenceLatitude"]),
                    float(global_obj.properties["ReferenceLongitude"]),
                ]

            for object_ids in chunks(list(app["tacview"].state.objects.keys()), 16):
                objs = [
                    app["tacview"].state.objects[i]
                    for i in object_ids
                    if i in app["tacview"].state.objects
                ]

                await resp.send(
                    json.dumps(
                        [
                            i.serialize(offset)
                            for i in objs
                            if "Air" in i.types or "Sea" in i.types
                        ]
                    )
                )

            while True:
                payload = await queue.get()
                await resp.send(payload)
    finally:
        app["subscribers"].remove(queue)


async def cors(request):
    return Response(text="", status=204, headers={"Access-Control-Allow-Origin": "*"})


async def start_tacview_client(app):
    app["tacview"] = TacViewClient(app["tacview_host"], app["tacview_port"])
    TacViewObserver(app)
    app["tacview_task"] = asyncio.create_task(app["tacview"].run())
    app["subscribers"] = []


async def stop_tacview_client(app):
    app["tacview_task"].cancel()
    await app["tacview_task"]


app = web.Application()
app.on_startup.append(start_tacview_client)
app.on_cleanup.append(stop_tacview_client)
app.router.add_route("GET", "/", stream_events)
app.router.add_route("OPTIONS", "/", cors)
