#!/usr/bin/env python3
"""Shows the site on this computer the way the live site (Cloudflare Pages) serves it.

Run:   python3 tools/serve.py          then open http://localhost:8124

It serves the folder above this one, and like the live site it
  - finds /about and /compare/a-vs-b without ".html",
  - sends the ".html" forms to the short ones,
  - follows the rules in _redirects (exact paths and the ones ending in /*),
  - shows 404.html for anything that is not there.
"""
import http.server, os, sys
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124

def rules():
    exact, splat = {}, []
    try:
        for line in open(os.path.join(ROOT, '_redirects'), encoding='utf8'):
            parts = line.split('#')[0].split()
            if len(parts) < 2: continue
            src, dst, code = parts[0], parts[1], int(parts[2]) if len(parts) > 2 else 302
            if src.endswith('/*'): splat.append((src[:-1], dst, code))
            else: exact[src] = (dst, code)
    except FileNotFoundError:
        pass
    return exact, splat

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)

    def go(self, to, code):
        self.send_response(code); self.send_header('Location', to); self.end_headers()

    def do_GET(self):
        url = urlsplit(self.path); path = url.path; tail = ('?' + url.query) if url.query else ''
        exact, splat = rules()
        hit = exact.get(path) or next(((d, c) for s, d, c in splat if path.startswith(s)), None)
        if hit: return self.go(hit[0], hit[1])
        if path.endswith('/index.html'): return self.go(path[:-10] + tail, 308)
        if path.endswith('.html') and os.path.isfile(ROOT + path): return self.go(path[:-5] + tail, 308)
        if not os.path.exists(ROOT + path) and os.path.isfile(ROOT + path + '.html'):
            self.path = path + '.html' + tail
            return super().do_GET()
        if not os.path.exists(ROOT + path):
            body = open(os.path.join(ROOT, '404.html'), 'rb').read()
            self.send_response(404); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()

    do_HEAD = do_GET

if __name__ == '__main__':
    print(f'Buoy on http://localhost:{PORT}  (folder: {ROOT})')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
