import asyncio
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, NamedTuple, Set

split_by_comma = re.compile(r"(?<!\\),")


@dataclass
class TacViewObject:
    id: int
    types: List[str] = field(default_factory=list)
    properties: Dict[str, Any] = field(default_factory=dict)
    longitude: float = 0
    latitude: float = 0
    altitude: float = 0
    heading: float = 0

    def serialize(self, coord_offset=None):
        data = asdict(self)
        if coord_offset is not None:
            data["latitude"] += coord_offset[0]
            data["longitude"] += coord_offset[1]
        return data

    def _update_position(self, payload):
        typ = payload.count("|")
        long = None
        lat = None
        alt = None
        heading = None

        if typ == 2:
            long, lat, alt = payload.split("|")
        elif typ == 4:
            long, lat, alt, _, _ = payload.split("|")
        elif typ == 5:
            long, lat, alt, _, _, _ = payload.split("|")
        elif typ == 8:
            long, lat, alt, _, _, _, _, _, heading = payload.split("|")
        else:
            raise Exception(f"Unsupported position format: {payload} ({typ})")

        if long:
            self.longitude = float(long)
        if lat:
            self.latitude = float(lat)
        if alt:
            self.altitude = float(alt)
        if heading:
            self.heading = float(heading)

    def process_event(self, event):
        properties = split_by_comma.split(event)
        for prop in properties:
            k, v = prop.split("=", 1)

            if k == "T":
                self._update_position(v)
            elif k == "Type":
                self.types = v.split("+")
            else:
                self.properties[k] = v


class TacViewFrame(NamedTuple):
    timestamp: int
    updated_objects: Set[int]
    deleted_objects: Set[int]


class TacViewState:
    objects: Dict[str, TacViewObject]

    def __init__(self, on_frame=None):
        self.objects = {}
        self._time_frame_buffer = []
        self._current_offset_time = 0
        self._on_frame = on_frame

    async def process_event(self, event):
        # This Complete timeframe
        if event.startswith("#"):
            await self._process_time_frame()
            self._current_offset_time = float(event[1:])
        else:
            self._time_frame_buffer.append(event)

    async def _process_time_frame(self):
        time_frame = self._time_frame_buffer
        self._time_frame_buffer = []

        deleted_objects = set()
        updated_objects = set()
        for event in time_frame:
            if event.startswith("FileType") or event.startswith("FileVersion"):
                continue

            if event.startswith("-"):
                object_id = int(event[1:], 16)
                if object_id in self.objects:
                    del self.objects[object_id]
                    deleted_objects.add(object_id)
            else:
                parts = event.split(",", 1)
                object_id = int(parts[0], 16)
                if object_id not in self.objects:
                    self.objects[object_id] = TacViewObject(id=object_id)
                self.objects[object_id].process_event(parts[1].rstrip())
                updated_objects.add(object_id)

        if self._on_frame is not None:
            await self._on_frame(
                TacViewFrame(
                    self._current_offset_time, updated_objects, deleted_objects
                )
            )


class TacViewClient:
    state: TacViewState

    def __init__(self, host, port=42674, on_frame=None):
        self._host = host
        self._port = port
        self.state = TacViewState(on_frame=on_frame)

    async def run(self):
        reader, writer = await asyncio.open_connection(self._host, self._port)

        # TODO: validate header
        await reader.read(1024)

        writer.write("XtraLib.Stream.0\n".encode("utf-8"))
        writer.write("Tacview.RealTimeTelemetry.0\n".encode("utf-8"))
        writer.write("Client sneaker\n".encode("utf-8"))
        writer.write("\x00\n".encode("utf-8"))
        await writer.drain()

        buffer = bytearray()
        while True:
            data = await reader.readline()
            if not data:
                break

            if data.endswith(b"\\\n"):
                buffer.extend(data)
                continue
            elif buffer:
                buffer.extend(data)
                data = buffer
                buffer = bytearray()

            await self.state.process_event(data.decode("utf-8"))

        writer.close()
        await writer.wait_closed()
