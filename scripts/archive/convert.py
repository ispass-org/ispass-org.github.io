"""
Turn the raw mirror into files a static host can serve at the original URLs.

- Every file is copied at its original path.
- An HTML page saved as `name.php` is stored as `name.php/index.html`. Static
  hosts serve a folder's index.html at the folder's URL, so `…/name.php` keeps
  working, but they cannot run PHP or reliably show a `.php` file as a page.
- Because such a page is now served from one folder deeper, its relative links
  (`images/x.png`, `../ispass11.css`, `committee.php`) are rewritten to the
  absolute paths they originally pointed at. Nothing else in the page changes.
"""
import pathlib, re, shutil, sys, urllib.parse

SRC, DST = map(pathlib.Path, sys.argv[1:3])
ATTR = re.compile(r"""((?:href|src|background|data|action)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>"']+))""", re.I)
CSSURL = re.compile(r"""(url\(\s*)(['"]?)([^'")]+)\2(\s*\))""", re.I)
SKIP = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//|/|#|\?)", re.I)

def absolutise(value, page_url):
    v = value.strip()
    if not v or SKIP.match(v):
        return value
    return urllib.parse.urljoin(page_url, v)

def rewrite(text, page_url):
    def attr(m):
        val = next(g for g in m.groups()[1:] if g is not None)
        q = '"' if m.group(2) is not None else ("'" if m.group(3) is not None else '"')
        return f"{m.group(1)}{q}{absolutise(val, page_url)}{q}"
    text = ATTR.sub(attr, text)
    text = CSSURL.sub(lambda m: f"{m.group(1)}{m.group(2)}{absolutise(m.group(3), page_url)}{m.group(2)}{m.group(4)}", text)
    return text

if DST.exists(): shutil.rmtree(DST)
converted = copied = 0
for f in sorted(SRC.rglob("*")):
    if f.is_dir() or f.name == "manifest.json": continue
    rel = f.relative_to(SRC).as_posix()
    if rel.lower().endswith(".php"):
        page_url = "/" + rel
        text = f.read_bytes().decode("latin-1")          # latin-1 round-trips every byte
        out = DST / rel / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(rewrite(text, page_url).encode("latin-1"))
        converted += 1
    else:
        out = DST / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, out)
        copied += 1
print(f"copied {copied} files, converted {converted} .php pages")
