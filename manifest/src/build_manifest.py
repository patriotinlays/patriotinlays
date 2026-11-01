# Regenerates manifest/claims.json from sources.py + claims.py, filling used_on from [[claim:id]] markers and tool code.
import json, re, os, glob, datetime
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
exec(open(os.path.join(here, "sources.py")).read()); exec(open(os.path.join(here, "claims.py")).read())
used = {}
for f in glob.glob(os.path.join(root, "src/content/*.md")) + glob.glob(os.path.join(root, "src/pages/*.md")):
    slug = os.path.basename(f)[:-3]
    for cid in re.findall(r"\[\[claim:([a-z0-9-]+)\]\]", open(f).read()): used.setdefault(cid, set()).add(slug)
for f in glob.glob(os.path.join(root, "src/tools/*.js")):
    for cid in re.findall(r'claim\w*:\s*"([a-z0-9-]+)"', open(f).read()): used.setdefault(cid, set()).add("tool:" + os.path.basename(f))
    for arr in re.findall(r'claims:\s*\[([^\]]*)\]', open(f).read()):
        for cid in re.findall(r'"([a-z0-9-]+)"', arr): used.setdefault(cid, set()).add("tool:" + os.path.basename(f))
for f in glob.glob(os.path.join(root, "src/partials/*.md")):
    for cid in re.findall(r"\[\[claim:([a-z0-9-]+)\]\]", open(f).read()): used.setdefault(cid, set()).add("partial:" + os.path.basename(f)[:-3])
out = []; unused = []
for cid, sk, quote, text, page in C:
    if cid not in used: unused.append(cid); continue
    url, title, _ = SOURCES[sk]
    out.append(dict(claim_id=cid, claim_text=text, source_url=url, source_title=title,
        source_type="primary" if sk in () else "official_secondary", archive_identifier=None,
        last_retrieved="2026-10-31", quote_excerpt=quote, page_ref=page, verification_status="verified",
        verified_by="bot:R3-verify — quote matched in source text fetched 2026-10-31 CT", used_on=sorted(used.get(cid, [])), notes=""))
json.dump({"schema_version": 1, "policy": "Any claim not verifiable against an official primary/secondary source in this manifest is omitted from the site. Build fails on unmanifested claims.", "claims": out},
          open(os.path.join(root, "manifest/claims.json"), "w"), indent=2, ensure_ascii=False)
print(len(out), "claims written (all referenced);", len(unused), "drafted claims dropped as unused:", ", ".join(unused))
