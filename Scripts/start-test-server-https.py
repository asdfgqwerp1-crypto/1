#!/usr/bin/env python3
"""HTTPS test server for camera pages (required on iOS Safari)."""
from __future__ import annotations

import http.server
import os
import socket
import ssl
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEST_PAGES = ROOT.parent / "TestPages"
CERT_DIR = ROOT / "certs"
CERT_FILE = CERT_DIR / "server.pem"
KEY_FILE = CERT_DIR / "server-key.pem"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443


def ensure_cert() -> None:
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    if CERT_FILE.exists() and KEY_FILE.exists():
        return

    print("Generating self-signed certificate...")
    subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(KEY_FILE),
            "-out", str(CERT_FILE),
            "-days", "365",
            "-subj", "/CN=SafariSpoof-Test/O=Dev/C=US",
        ],
        check=True,
    )


def local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "YOUR_PC_IP"


def main() -> None:
    ensure_cert()
    os.chdir(TEST_PAGES)

    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.HTTPServer(("0.0.0.0", PORT), handler)

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

    ip = local_ip()
    print()
    print(" HTTPS test server (camera pages)")
    print(f" Directory: {TEST_PAGES}")
    print()
    print(" On iPhone Safari:")
    print(f"   https://{ip}:{PORT}/")
    print(f"   https://{ip}:{PORT}/webrtc-inspector/")
    print()
    print(" iOS покажет предупреждение о сертификате:")
    print("   Подробнее -> посетить этот веб-сайт")
    print()
    print(" Press Ctrl+C to stop")
    print()

    httpd.serve_forever()


if __name__ == "__main__":
    main()