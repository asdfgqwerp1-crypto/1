#!/usr/bin/env python3
"""OBS → MediaMTX → ffmpeg → latest JPEG over HTTP (low latency for iPhone)."""
from __future__ import annotations

import argparse
import http.server
import socketserver
import subprocess
import threading

SOI = b"\xff\xd8"
EOI = b"\xff\xd9"


class FrameStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data = b""

    def update(self, data: bytes) -> None:
        with self._lock:
            self._data = data

    def get(self) -> bytes:
        with self._lock:
            return self._data


def ffmpeg_bin() -> str:
    import os
    from pathlib import Path

    env = os.environ.get("FFMPEG_BIN")
    if env:
        return env
    local = Path.home() / ".local" / "bin" / "ffmpeg"
    if local.is_file():
        return str(local)
    return "ffmpeg"


def mjpeg_reader(rtsp_url: str, store: FrameStore, vf: str) -> None:
    cmd = [
        ffmpeg_bin(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-rtsp_transport",
        "tcp",
        "-i",
        rtsp_url,
        "-an",
        "-vf",
        vf,
        "-pix_fmt",
        "yuvj420p",
        "-f",
        "mjpeg",
        "pipe:1",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    buf = b""
    while True:
        chunk = proc.stdout.read(8192)
        if not chunk:
            err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
            if err.strip():
                print(f"[frame-relay] ffmpeg ended: {err.strip()}", flush=True)
            break
        buf += chunk
        while True:
            start = buf.find(SOI)
            if start < 0:
                buf = b""
                break
            end = buf.find(EOI, start + 2)
            if end < 0:
                buf = buf[start:]
                break
            frame = buf[start : end + 2]
            buf = buf[end + 2 :]
            store.update(frame)


class FrameHandler(http.server.BaseHTTPRequestHandler):
    store: FrameStore | None = None

    def do_HEAD(self) -> None:
        self._serve_frame(head_only=True)

    def do_GET(self) -> None:
        self._serve_frame(head_only=False)

    def _serve_frame(self, head_only: bool) -> None:
        path = self.path.split("?", 1)[0]
        if path not in ("/frame.jpg", "/"):
            self.send_error(404)
            return
        data = b"" if self.store is None else self.store.get()
        if not data:
            self.send_error(503, "No frame yet — start OBS stream first")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Low-latency JPEG frame relay")
    parser.add_argument("--rtsp", default="rtsp://127.0.0.1:8554/live/obs")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--width", type=int, default=480)
    parser.add_argument("--height", type=int, default=640)
    parser.add_argument("--fps", type=int, default=30)
    args = parser.parse_args()

    vf = (
        f"fps={args.fps},"
        f"scale={args.width}:{args.height}:force_original_aspect_ratio=increase,"
        f"crop={args.width}:{args.height}"
    )
    store = FrameStore()
    FrameHandler.store = store
    threading.Thread(target=mjpeg_reader, args=(args.rtsp, store, vf), daemon=True).start()

    with socketserver.ThreadingTCPServer(("0.0.0.0", args.port), FrameHandler) as httpd:
        print(f"Frame relay listening on http://0.0.0.0:{args.port}/frame.jpg", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()