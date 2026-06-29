#!/usr/bin/env python3
"""Static + HTTP smoke tests for injection pipeline (no Node required)."""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8091
BASE = f"http://127.0.0.1:{PORT}"


def fetch(path: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(f"{BASE}{path}", timeout=5) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception as exc:
        return 0, str(exc)


def main() -> int:
    failed = 0
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "Scripts" / "injection-test-server.py"), "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)

    try:
        profile_path = ROOT / "SafariSpoofBrowser" / "Profiles" / "Profiles" / "iphone11_ios265.json"
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        assert profile["id"] == "iphone11_ios265", "profile id"
        print("PASS profile JSON")

        modules = [
            "/injection/fingerprint/navigator.js",
            "/injection/media/frameReceiver.js",
            "/injection/media/getUserMedia.js",
            "/injection/webrtc/enumerateDevices.js",
            "/injection-lab/loader.js",
        ]
        for module in modules:
            status, body = fetch(module)
            if status != 200 or len(body) < 20:
                print(f"FAIL fetch {module} status={status}")
                failed += 1
            else:
                print(f"PASS fetch {module}")

        _, frame_js = fetch("/injection/media/frameReceiver.js")
        if "spoofframe://" not in frame_js:
            print("FAIL frameReceiver missing spoofframe URL")
            failed += 1
        else:
            print("PASS frameReceiver uses spoofframe scheme")

        _, gum_js = fetch("/injection/media/getUserMedia.js")
        if "__spoofStartFramePoll" not in gum_js:
            print("FAIL getUserMedia missing frame poll hook")
            failed += 1
        else:
            print("PASS getUserMedia starts frame poll")

        status, html = fetch("/injection-lab/")
        if status != 200 or "loader.js" not in html:
            print(f"FAIL injection-lab page status={status}")
            failed += 1
        else:
            print("PASS injection-lab page")

        scheme = (ROOT / "SafariSpoofBrowser" / "Bridge" / "FrameSchemeHandler.swift").read_text(encoding="utf-8")
        if "WKURLSchemeHandler" not in scheme:
            print("FAIL FrameSchemeHandler missing")
            failed += 1
        else:
            print("PASS FrameSchemeHandler present")

    finally:
        server.terminate()
        server.wait(timeout=5)

    print(f"\nDone: {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())