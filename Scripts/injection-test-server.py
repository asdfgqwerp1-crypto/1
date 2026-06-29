#!/usr/bin/env python3
"""HTTP server for injection-lab: TestPages + injection JS + profiles."""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent.parent
ROUTES = {
    "/injection": ROOT / "SafariSpoofBrowser" / "Resources" / "injection",
    "/profiles": ROOT / "SafariSpoofBrowser" / "Profiles" / "Profiles",
}


class InjectionHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def translate_path(self, path: str) -> str:
        clean = unquote(path.split("?", 1)[0])
        for prefix, base in ROUTES.items():
            if clean == prefix or clean.startswith(prefix + "/"):
                rel = clean[len(prefix) :].lstrip("/")
                target = base / rel if rel else base
                return str(target.resolve())
        return super().translate_path(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()

    handler = partial(InjectionHandler, directory=str(ROOT / "TestPages"))
    server = ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    print(f"Injection test server http://127.0.0.1:{args.port}/injection-lab/")
    server.serve_forever()


if __name__ == "__main__":
    main()