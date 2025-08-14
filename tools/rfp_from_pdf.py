import argparse, json, subprocess, sys, os, re, shutil
def extract_text(path: str) -> str:
    if shutil.which("pdftotext"):
        try:
            p = subprocess.run(["pdftotext","-layout","-nopgbrk","-q",path,"-"],
                               check=True, capture_output=True, text=True)
            return p.stdout.strip()
        except Exception:
            pass
    from pypdf import PdfReader
    out=[]; 
    for pg in PdfReader(path).pages:
        out.append(pg.extract_text() or "")
    return ("\n\n".join(out)).strip()
def slugify(name: str) -> str:
    s = os.path.splitext(os.path.basename(name))[0]
    return re.sub(r"[^A-Za-z0-9]+","-",s).strip("-").lower() or "rfp"
ap = argparse.ArgumentParser()
ap.add_argument("--pdf", required=True)
ap.add_argument("--id", default=None)
ap.add_argument("--title", default=None)
ap.add_argument("--buyer", default="Parks Canada")
ap.add_argument("--jurisdiction", default="CA-federal")
ap.add_argument("--method", default="RFP")
ap.add_argument("--tags", default="general")
ap.add_argument("--source", default="bulk-pdf")
ap.add_argument("--summary", default=None)
a = ap.parse_args()
text = extract_text(os.path.expanduser(a.pdf))
rid = a.id or slugify(a.pdf)
title = a.title or os.path.splitext(os.path.basename(a.pdf))[0].replace("_"," ").replace("-"," ").strip()
summary = a.summary or (" ".join(text.split()[:30]) + ("…" if len(text.split())>30 else ""))
doc = {
  "id": rid,
  "title": title,
  "procurement_method": a.method,
  "buyer": { "name": a.buyer, "jurisdiction": a.jurisdiction },
  "industry_tags": [t.strip() for t in a.tags.split(",") if t.strip()] or ["general"],
  "summary": summary or "Summary not provided.",
  "text": text,
  "source": a.source
}
print(json.dumps(doc, ensure_ascii=False, indent=2))
