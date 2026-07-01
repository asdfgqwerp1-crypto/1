#!/usr/bin/env python3
"""OBS → MediaMTX → ffmpeg → latest JPEG over HTTP (low latency for iPhone)."""
from __future__ import annotations

import argparse
import http.server
import socketserver
import subprocess
import threading
import time

SOI = b"\xff\xd8"
EOI = b"\xff\xd9"


class FrameStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data = b""
        self._seq = 0
        self._updated_at = 0.0

    def update(self, data: bytes) -> None:
        with self._lock:
            if data != self._data:
                self._seq += 1
            self._data = data
            self._updated_at = time.time()

    def get(self) -> tuple[bytes, int, float]:
        with self._lock:
            age = time.time() - self._updated_at if self._updated_at else 999.0
            return self._data, self._seq, age


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


def run_ffmpeg_loop(rtsp_url: str, store: FrameStore, vf: str, stall_sec: float) -> None:
    while True:
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
            "-q:v",
            "3",
            "-f",
            "mjpeg",
            "pipe:1",
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert proc.stdout is not None
        buf = b""
        last_frame_at = time.time()
        print(f"[frame-relay] ffmpeg started pid={proc.pid}", flush=True)

        while True:
            if time.time() - last_frame_at > stall_sec:
                print(
                    f"[frame-relay] ffmpeg stall >{stall_sec:.0f}s, restarting",
                    flush=True,
                )
                proc.kill()
                break

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
                last_frame_at = time.time()

        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()

        time.sleep(0.5)


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
        if self.store is None:
            self.send_error(503, "Relay not ready")
            return
        data, seq, age = self.store.get()
        if not data:
            self.send_error(503, "No frame yet - start OBS stream first")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Relay-Seq", str(seq))
        self.send_header("X-Relay-Age-Ms", str(int(age * 1000)))
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def log_message(self, fmt: str, *args) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Low-latency JPEG frame relay")
    parser.add_argument("--rtsp", default="rtsp://127.0.0.1:8554/live/obs")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--stall-sec", type=float, default=5.0)
    args = parser.parse_args()

    vf = (
        f"fps={args.fps},"
        f"scale={args.width}:{args.height}:force_original_aspect_ratio=increase,"
        f"crop={args.width}:{args.height}"
    )
    store = FrameStore()
    FrameHandler.store = store
    threading.Thread(
        target=run_ffmpeg_loop,
        args=(args.rtsp, store, vf, args.stall_sec),
        daemon=True,
    ).start()

    class ReuseTCPServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    with ReuseTCPServer(("0.0.0.0", args.port), FrameHandler) as httpd:
        print(f"Frame relay listening on http://0.0.0.0:{args.port}/frame.jpg", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()