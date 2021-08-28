import argparse

from aiohttp import web

from .http import app


def main():
    parser = argparse.ArgumentParser("sneaker-server")
    parser.add_argument(
        "--tacview-host", help="The tacview realtime telemetry host", required=True
    )
    parser.add_argument(
        "--tacview-port",
        type=int,
        default=42674,
        help="The tacview realtime telemetry port",
    )
    parser.add_argument(
        "--bind",
        default="localhost:7788",
        help="The local bind string for the HTTP server",
    )

    args = parser.parse_args()
    host = args.bind
    port = 7788
    if ":" in host:
        host, port = host.split(":", 1)
        port = int(port)

    app["tacview_host"] = args.tacview_host
    app["tacview_port"] = args.tacview_port
    web.run_app(app, host=host, port=port)


main()
