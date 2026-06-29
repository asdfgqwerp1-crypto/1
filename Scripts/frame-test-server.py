#!/usr/bin/env python3
"""HTTP server that mimics FrameSchemeHandler for Linux frame-pipeline tests."""
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

# Minimal valid JPEG (2x2) — same as FrameSchemeHandler placeholder
PLACEHOLDER_JPEG = bytes([
    0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
    0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27,
    0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34,
    0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B,
    0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00,
    0x00, 0x3F, 0x00, 0x7F, 0xFF, 0xD9,
])

FRAME_WIDTH = 480
FRAME_HEIGHT = 640
FRAME_SEQ = 0


def make_nv12_pattern(width: int, height: int) -> bytes:
    """Bright top / dark bottom — decodes to visible contrast, not placeholder green."""
    y_size = width * height
    buf = bytearray((y_size * 3) // 2)
    for row in range(height):
        y_val = 210 if row < height // 2 else 40
        base = row * width
        for col in range(width):
            buf[base + col] = y_val
    uv_start = y_size
    uv_row_bytes = width
    for row in range(height // 2):
        row_base = uv_start + row * uv_row_bytes
        for col in range(0, width, 2):
            buf[row_base + col] = 128
            buf[row_base + col + 1] = 128
    return bytes(buf)


NV12_FRAME = make_nv12_pattern(FRAME_WIDTH, FRAME_HEIGHT)


def make_jpeg_pattern(width: int, height: int) -> bytes:
    try:
        from io import BytesIO

        from PIL import Image

        img = Image.new("RGB", (width, height))
        px = img.load()
        for row in range(height):
            color = (210, 90, 50) if row < height // 2 else (45, 45, 130)
            for col in range(width):
                px[col, row] = color
        out = BytesIO()
        img.save(out, format="JPEG", quality=82)
        return out.getvalue()
    except Exception:
        return PLACEHOLDER_JPEG


JPEG_FRAME = make_jpeg_pattern(FRAME_WIDTH, FRAME_HEIGHT)
CHUNK_BYTE_SIZE = 49_152
NV12_CHUNKS = [
    NV12_FRAME[i : i + CHUNK_BYTE_SIZE]
    for i in range(0, len(NV12_FRAME), CHUNK_BYTE_SIZE)
]
EXPOSE_HEADERS = (
    "Content-Type,X-Frame-Format,X-Frame-Chunks,X-Frame-Seq,X-Frame-PTS-Us,"
    "X-Frame-Width,X-Frame-Height,X-Frame-Part,X-Frame-Part-Count"
)


class FrameTestHandler(SimpleHTTPRequestHandler):
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

    def _query(self, name: str) -> str | None:
        if "?" not in self.path:
            return None
        query = self.path.split("?", 1)[1]
        for part in query.split("&"):
            if part.startswith(name + "="):
                return part.split("=", 1)[1]
        return None

    def _send_frame(
        self,
        payload: bytes,
        fmt: str,
        width: int,
        height: int,
        seq: int,
        chunk_count: int,
        part_index: int | None = None,
    ) -> None:
        content_type = (
            "application/vnd.safarispoof.nv12" if fmt == "nv12" else "image/jpeg"
        )
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.send_header("Access-Control-Expose-Headers", EXPOSE_HEADERS)
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("X-Frame-Format", fmt)
        self.send_header("X-Frame-Width", str(width))
        self.send_header("X-Frame-Height", str(height))
        self.send_header("X-Frame-Seq", str(seq))
        self.send_header("X-Frame-PTS-Us", str(seq * 66_000))
        self.send_header("X-Frame-Chunks", str(chunk_count))
        if part_index is not None:
            self.send_header("X-Frame-Part", str(part_index))
            self.send_header("X-Frame-Part-Count", str(chunk_count))
        self.end_headers()
        if payload:
            self.wfile.write(payload)

    def do_GET(self) -> None:
        global FRAME_SEQ
        clean = unquote(self.path.split("?", 1)[0])
        if clean == "/frame/jpeg":
            FRAME_SEQ += 1
            self._send_frame(JPEG_FRAME, "jpeg", FRAME_WIDTH, FRAME_HEIGHT, FRAME_SEQ, 1)
            return
        if clean == "/frame/part":
            part = int(self._query("p") or "-1")
            if 0 <= part < len(NV12_CHUNKS):
                self._send_frame(
                    NV12_CHUNKS[part],
                    "nv12",
                    FRAME_WIDTH,
                    FRAME_HEIGHT,
                    FRAME_SEQ,
                    len(NV12_CHUNKS),
                    part,
                )
            else:
                self.send_error(404)
            return
        if clean in ("/frame/latest", "/frame/nv12", "/frame/jpeg", "/frame/jpeg-live", "/frame/placeholder"):
            if clean == "/frame/jpeg-live":
                FRAME_SEQ += 1
                self._send_frame(JPEG_FRAME, "jpeg", FRAME_WIDTH, FRAME_HEIGHT, FRAME_SEQ, 1)
                return
            if clean in ("/frame/jpeg", "/frame/placeholder"):
                FRAME_SEQ += 1
                self._send_frame(PLACEHOLDER_JPEG, "jpeg", 2, 2, FRAME_SEQ, 1)
                return
            FRAME_SEQ += 1
            self._send_frame(b"", "nv12", FRAME_WIDTH, FRAME_HEIGHT, FRAME_SEQ, len(NV12_CHUNKS))
            return
        return super().do_GET()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8093)
    args = parser.parse_args()
    handler = partial(FrameTestHandler, directory=str(ROOT / "TestPages"))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Frame test server http://127.0.0.1:{args.port}/frame-pipeline-test/")
    server.serve_forever()


if __name__ == "__main__":
    main()