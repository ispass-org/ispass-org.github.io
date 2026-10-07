"""
Mirror the archived ISPASS sites from the old host, read-only.

Fetches over plain HTTP from the old server's IP with the real Host header, so
it works regardless of what public DNS currently says. Follows every same-site
reference (links, frames, images, scripts, stylesheets, CSS url()) that stays
inside an archive year, plus root-level assets (e.g. /ispass11.css) that an
archive page uses. Nothing on the server is modified.

Output: <out>/<path> exactly as served, plus manifest.json describing every URL.
"""
import json, re, sys, time, urllib.request, urllib.parse, http.client, pathlib, collections

OLD_IP = "66.96.146.129"
HOST = "www.ispass.org"
HOSTS = {"www.ispass.org", "ispass.org"}
YEAR_RE = re.compile(r"^/ispass(\d{4})(/|$)", re.I)

def fetch(path):
    for attempt in range(3):
        try:
            c = http.client.HTTPConnection(OLD_IP, 80, timeout=30)
            c.request("GET", urllib.parse.quote(path, safe="/%:@&=+$,;~-._?#!*'()"),
                      headers={"Host": HOST, "User-Agent": "ISPASS-archive-mirror/1.0 (read-only)"})
            r = c.getresponse()
            body = r.read()
            hdr = {k.lower(): v for k, v in r.getheaders()}
            c.close()
            return r.status, hdr, body
        except Exception as e:
            err = e; time.sleep(1.5)
    return None, {"error": str(err)}, b""

ATTR_RE = re.compile(r"""(?:href|src|background|data|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", re.I)
CSS_URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", re.I)
COMMENT_RE = re.compile(r"<!--[\s\S]*?-->")

def refs(body, ctype):
    text = body.decode("latin-1", "replace")
    out = []
    if "html" in ctype:
        live = COMMENT_RE.sub(" ", text)          # links inside HTML comments are dead
        out += [next(g for g in m.groups() if g is not None) for m in ATTR_RE.finditer(live)]
        out += CSS_URL_RE.findall(live)
    elif "css" in ctype:
        out += CSS_URL_RE.findall(text)
    return out

def normalise(base, ref):
    ref = ref.strip()
    if not ref or ref.startswith(("#", "mailto:", "javascript:", "tel:", "data:")):
        return None
    u = urllib.parse.urlsplit(urllib.parse.urljoin("http://" + HOST + base, ref))
    if u.scheme not in ("http", "https") or u.hostname not in HOSTS:
        return None
    path = urllib.parse.unquote(u.path) or "/"
    return path

def main(years, out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    queue = collections.deque(f"/ispass{y}/" for y in years)
    seen, manifest = set(), {}
    while queue:
        path = queue.popleft()
        if path in seen: continue
        seen.add(path)
        status, hdr, body = fetch(path)
        ctype = hdr.get("content-type", "")
        entry = {"status": status, "type": ctype.split(";")[0], "bytes": len(body)}
        if status in (301, 302, 303, 307, 308):
            loc = hdr.get("location", "")
            entry["location"] = loc
            nxt = normalise(path, loc)
            if nxt and nxt not in seen: queue.append(nxt)
        manifest[path] = entry
        if status != 200:
            continue
        save = path + "index.html" if path.endswith("/") else path
        dest = out / save.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        entry["saved"] = save
        in_year = YEAR_RE.match(path)
        for ref in refs(body, ctype):
            nxt = normalise(path, ref)
            if not nxt or nxt in seen: continue
            m = YEAR_RE.match(nxt)
            if m:
                if in_year and m.group(1) != in_year.group(1):
                    continue           # another year: reached from its own root
                queue.append(nxt)
            elif in_year and re.search(r"\.(css|js|png|gif|jpe?g|ico|svg|pdf)$", nxt, re.I):
                queue.append(nxt)      # shared root-level asset used by an archive
        if len(seen) % 200 == 0:
            print(f"  ...{len(seen)} URLs", file=sys.stderr, flush=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True))
    return manifest

if __name__ == "__main__":
    years = [int(y) for y in sys.argv[2].split(",")]
    m = main(years, sys.argv[1])
    print(f"fetched {len(m)} URLs")
