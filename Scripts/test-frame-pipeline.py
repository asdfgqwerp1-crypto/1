#!/usr/bin/env python3
"""Linux WebKit test: NV12 decode + canvas.captureStream must update (WKWebView parity)."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("FRAME_TEST_PORT", "8093"))
BASE_URL = os.environ.get("FRAME_TEST_URL", f"http://127.0.0.1:{PORT}/frame-pipeline-test/")


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("FAIL playwright not installed — run: pip install playwright && playwright install webkit")
        return 1

    server = subprocess.Popen(
        [sys.executable, str(ROOT / "Scripts" / "frame-test-server.py"), "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)

    try:
        with sync_playwright() as p:
            browser = p.webkit.launch()
            page = browser.new_page()
            page.goto(BASE_URL, wait_until="load", timeout=30000)
            page.wait_for_function("window.__FRAME_PIPELINE_RESULTS__", timeout=30000)
            results = page.evaluate("window.__FRAME_PIPELINE_RESULTS__")
            browser.close()

        print(f"Frame pipeline: {results['passed']} passed, {results['failed']} failed")
        for test in results["tests"]:
            status = "PASS" if test["ok"] else "FAIL"
            detail = f" — {test['detail']}" if test.get("detail") else ""
            print(f"{status} {test['name']}{detail}")

        return 1 if results["failed"] > 0 else 0
    except Exception as exc:
        print(f"FAIL runner: {exc}")
        return 1
    finally:
        server.terminate()
        server.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())