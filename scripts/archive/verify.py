"""
Check a served copy of the archives against the original crawl.

  python3 scripts/archive/verify.py http://127.0.0.1:4500 scripts/archive/manifest.json [mirror-dir]

Every URL that loaded on the old host must load here (pages ending in .php
must come back as HTML), and every link inside an archived page must still
resolve unless it was already broken on the old host. With a mirror directory,
non-PHP files are also compared byte for byte.
"""
import json, re, sys, urllib.request, urllib.parse, collections, pathlib
BASE = sys.argv[1].rstrip("/")
m = json.load(open(sys.argv[2]))
MIRROR = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
def get(path):
    try:
        r = urllib.request.urlopen(BASE + urllib.parse.quote(path), timeout=10)
        return r.status, r.headers.get("content-type",""), r.read(), r.geturl()
    except urllib.error.HTTPError as e: return e.code, "", b"", ""
fails, ok = [], 0
for path, e in sorted(m.items()):
    if e["status"] != 200: continue
    st, ct, body, final = get(path)
    if st != 200: fails.append((st, path)); continue
    if path.lower().endswith(".php") and "html" not in ct: fails.append((f"type {ct}", path)); continue
    if MIRROR and not path.lower().endswith(".php") and not path.endswith("/"):
        orig = (MIRROR / path.lstrip("/")).read_bytes()
        if orig != body: fails.append(("content differs", path)); continue
    ok += 1
print(f"original addresses that load: {ok} / {sum(1 for e in m.values() if e['status']==200)}")
for f in fails[:20]: print("   FAIL", f)

# Every link/frame/image inside every archived page must still resolve,
# unless it was already broken on the old host.
ATTR = re.compile(r"""(?:href|src|background|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""", re.I)
CSS = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", re.I)
old_bad = {p for p, e in m.items() if e["status"] not in (200, 301, 302)}
old_bad |= {p.rstrip("/") for p in old_bad} | {"/ispass2002", "/ispass2002/"}   # gone on the old host
broken, checked = collections.defaultdict(set), 0
for path, e in m.items():
    if e["status"] != 200 or "html" not in e["type"]: continue
    st, ct, body, final = get(path)
    page = final.replace(BASE, "") or path
    text = re.sub(r"<!--[\s\S]*?-->", " ", body.decode("latin-1"))
    for ref in [next(g for g in mm.groups() if g is not None) for mm in ATTR.finditer(text)] + CSS.findall(text):
        ref = ref.strip()
        if not ref or ref.startswith(("#","mailto:","javascript:","data:","tel:")): continue
        u = urllib.parse.urlsplit(urllib.parse.urljoin("http://www.ispass.org" + page, ref))
        if u.hostname not in ("www.ispass.org", "ispass.org") or u.scheme not in ("http","https"): continue
        target = urllib.parse.unquote(u.path) or "/"
        if not re.match(r"^/ispass\d{4}|^/ispass\d+\.css$", target): continue
        checked += 1
        if target in old_bad: continue
        if get(target)[0] != 200: broken[target].add(path)
print(f"links inside archived pages checked: {checked}; newly broken: {len(broken)}")
for t, srcs in sorted(broken.items())[:25]: print(f"   {t}   (from {sorted(srcs)[0]})")
