#!/usr/bin/env python3
"""Serve dist/ plus a direct APK download and a TV install page."""

import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "dist"
APK = Path("/workspace/android/app/build/outputs/apk/debug/app-debug.apk")
TV = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IPTV Gladiator — TV</title>
  <style>
    html, body { margin: 0; height: 100%; background: #10110e; color: #f4f0e4; font-family: "Segoe UI", sans-serif; }
    main { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; padding: 32px; text-align: center; }
    h1 { font-size: clamp(2.4rem, 6vw, 4.5rem); margin: 0; letter-spacing: -0.03em; }
    p { font-size: clamp(1.2rem, 2.5vw, 1.8rem); max-width: 18em; margin: 0; color: #d9d3c3; }
    a { display: inline-block; background: #e0b15a; color: #1a1408; text-decoration: none; font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 700; padding: 28px 48px; border-radius: 20px; }
    a:focus { outline: 6px solid #fff; outline-offset: 6px; }
  </style>
</head>
<body>
  <main>
    <h1>IPTV Gladiator</h1>
    <p>Installez l’application sur le téléphone, Android TV ou Fire TV.</p>
    <a href="/gladiator.apk">Télécharger</a>
  </main>
</body>
</html>
"""


MAX_RELAY = 20 * 1024 * 1024


def rewrite_playlist(text: str, playlist_url: str, public: str) -> bytes:
    def absolute(ref: str) -> str:
        return urllib.parse.urljoin(playlist_url, ref.strip())

    def relay(target: str) -> str:
        return public + "/relay?url=" + urllib.parse.quote(absolute(target), safe="")

    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if "URI=\"" in line and stripped.startswith("#"):
            lines.append(re.sub(r'URI="([^"]+)"', lambda match: 'URI="' + relay(match.group(1)) + '"', line))
        elif stripped and not stripped.startswith("#"):
            lines.append(relay(stripped))
        else:
            lines.append(line)
    return ("\n".join(lines) + "\n").encode("utf-8")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_HEAD(self):
        path = self.path.split("?", 1)[0]
        if path == "/gladiator.apk":
            data = APK.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.android.package-archive")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Content-Disposition", 'attachment; filename="gladiator.apk"')
            self.end_headers()
            return
        if path in ("/tv", "/tv/"):
            body = TV.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return
        return super().do_HEAD()

    def fail(self, code: int, message: str):
        body = message.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def relay(self):
        query = urllib.parse.urlparse(self.path).query
        target = (urllib.parse.parse_qs(query).get("url") or [""])[0]
        if not target.startswith("http://") and not target.startswith("https://"):
            self.send_error(400, "Adresse refusée")
            return
        host = self.headers.get("Host", "127.0.0.1:4189")
        proto = "https" if self.headers.get("X-Forwarded-Proto", "").split(",")[0].strip() == "https" else "http"
        public = proto + "://" + host
        request = urllib.request.Request(
            target,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
        )
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                data = response.read(MAX_RELAY + 1)
                ctype = response.headers.get("Content-Type", "application/octet-stream")
                status = getattr(response, "status", 200)
        except urllib.error.HTTPError as error:
            detail = error.read(400).decode("utf-8", "replace").replace("\n", " ").strip()
            self.fail(error.code, f"HTTP {error.code} — {error.reason}" + (f" — {detail[:180]}" if detail else ""))
            return
        except Exception as error:
            self.fail(502, f"Relais : {error}")
            return
        if len(data) > MAX_RELAY:
            self.fail(413, "HTTP 413 — réponse trop volumineuse")
            return
        if status >= 400:
            self.fail(status, f"HTTP {status}")
            return
        sample = data[:8000]
        if b"#EXT-X-" in sample:
            data = rewrite_playlist(data.decode("utf-8", "replace"), target, public)
            ctype = "application/vnd.apple.mpegurl"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/relay":
            self.relay()
            return
        if path == "/gladiator.apk":
            data = APK.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.android.package-archive")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Content-Disposition", 'attachment; filename="gladiator.apk"')
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
            return
        if path in ("/tv", "/tv/"):
            body = TV.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4189), Handler)
    server.serve_forever()
