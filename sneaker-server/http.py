import asyncio
import json
import time

from aiohttp import web
from aiohttp.web_response import Response
from aiohttp_sse import sse_response

from .tacview_client import TacViewClient, TacViewObject

SYNCED_TYPES = {"Air", "Sea", "Bullseye"}


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
        self._deleted_objects |= frame.deleted_objects

        if not self._last_dispatch or time.time() - self._last_dispatch > 2:
            await self.dispatch()

    async def dispatch(self):
        offset = get_offset()

        self._last_dispatch = time.time()

        created = []
        for object_id in self._updated_objects:
            obj: TacViewObject = self._client.state.objects.get(object_id)
            if not obj:
                continue

            if not obj.types & SYNCED_TYPES:
                continue

            created.append(obj.serialize(offset))

        events = []
        if created:
            events.append(json.dumps({"e": "CREATE", "o": created}))

        if self._deleted_objects:
            events.append(
                json.dumps({"e": "DELETE", "id": list(self._deleted_objects)})
            )

        for sub in self._app["subscribers"]:
            for event in events:
                await sub.put(event)

        self._updated_objects = set()
        self._deleted_objects = set()


async def stream_events(request):
    queue = asyncio.Queue(32)
    app["subscribers"].append(queue)
    try:
        async with sse_response(
            request, headers={"Access-Control-Allow-Origin": "*"}
        ) as resp:
            offset = get_offset()
            for object_ids in chunks(list(app["tacview"].state.objects.keys()), 16):
                objs = [
                    app["tacview"].state.objects[i]
                    for i in object_ids
                    if i in app["tacview"].state.objects
                ]

                await resp.send(
                    json.dumps(
                        {
                            "e": "CREATE",
                            "o": [
                                i.serialize(offset)
                                for i in objs
                                if i.types & SYNCED_TYPES
                            ],
                        }
                    )
                )

            while True:
                payload = await queue.get()
                await resp.send(payload)
    finally:
        app["subscribers"].remove(queue)


async def cors(request):
    return Response(text="", status=204, headers={"Access-Control-Allow-Origin": "*"})


async def get_objects(request):
    offset = get_offset()

    limit = request.query.get("limit", 100)
    target_type = request.query.get("type")

    objects = []
    for obj in app["tacview"].state.objects.values():
        if target_type and target_type.title() not in obj.types:
            continue

        objects.append(obj.serialize(offset))
        if len(objects) == limit:
            break

    return Response(
        text=json.dumps(objects),
        status=200,
        headers={"Content-Type": "application/json"},
    )


async def start_tacview_client(app):
    app["tacview"] = TacViewClient(app["tacview_host"], app["tacview_port"])
    TacViewObserver(app)
    app["tacview_task"] = asyncio.create_task(app["tacview"].run())
    app["subscribers"] = []


async def stop_tacview_client(app):
    app["tacview_task"].cancel()
    await app["tacview_task"]


def get_offset():
    global_obj = app["tacview"].state.objects.get(0)
    if not global_obj:
        print("Missing global obj, cannot dispatch data")
        return

    if "ReferenceLongitude" in global_obj.properties:
        offset = [
            float(global_obj.properties["ReferenceLatitude"]),
            float(global_obj.properties["ReferenceLongitude"]),
        ]
    return offset


app = web.Application()
app.on_startup.append(start_tacview_client)
app.on_cleanup.append(stop_tacview_client)
app.router.add_route("GET", "/", stream_events)
app.router.add_route("OPTIONS", "/", cors)
app.router.add_route("GET", "/objects", get_objects)
