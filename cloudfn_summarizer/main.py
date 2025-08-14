import re, json, io
from typing import List
from pypdf import PdfReader
import functions_framework

STOPWORDS = set("""
a an and are as at be by for from has have in is it its of on or that the to was were will with your you we our this those these not
""".split())

def extract_text(pdf_bytes: bytes):
  reader = PdfReader(io.BytesIO(pdf_bytes))
  pages = len(reader.pages)
  texts, first_page = [], ""
  for i, p in enumerate(reader.pages):
    try:
      t = p.extract_text() or ""
    except Exception:
      t = ""
    texts.append(t)
    if i == 0:
      first_page = t
  return "\n".join(texts), pages, first_page

def top_sentences(text: str, limit: int = 6) -> List[str]:
  sents = re.split(r'(?<=[\.\?!])\s+|\n{2,}', text)
  sents = [s.strip() for s in sents if s.strip()]
  freq = {}
  for w in re.findall(r"[A-Za-z][A-Za-z\-']{1,}", text.lower()):
    if w in STOPWORDS: continue
    freq[w] = freq.get(w, 0) + 1
  scored = []
  for i, s in enumerate(sents):
    sc = sum(freq.get(w.lower(), 0) for w in re.findall(r"[A-Za-z][A-Za-z\-']{1,}", s))
    scored.append((sc, i, s))
  scored.sort(reverse=True)
  keep = sorted(scored[:limit], key=lambda x: x[1])
  return [s for _,_,s in keep]

def find_all(pat: re.Pattern, text: str, limit=5):
  out = []
  for m in pat.finditer(text):
    out.append(m.group(0))
    if len(out) >= limit: break
  return out

@functions_framework.http
def summarize_http(request):
  if request.method == "OPTIONS":
    return ("", 204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    })

  headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

  if "multipart/form-data" in (request.headers.get("Content-Type") or ""):
    f = request.files.get("file") or request.files.get("pdf")
    if not f:
      return (json.dumps({"error":"no 'file' field in form-data"}), 400, headers)
    data, filename = f.read(), f.filename
  else:
    data, filename = (request.get_data() or b""), "upload.bin"

  if not data:
    return (json.dumps({"error":"empty upload"}), 400, headers)

  try:
    text, pages, first_page = extract_text(data)
  except Exception as e:
    return (json.dumps({"error":"failed to read PDF (maybe scanned?)", "detail": str(e)}), 400, headers)

  compact = re.sub(r"\s+", " ", text).strip()

  date_pats = [
    re.compile(r"(?:Closing|Close|Due|Deadline)[^\n]{0,40}?:\s*(\w{3,9}\s+\d{1,2},\s+\d{4})", re.I),
    re.compile(r"(?:Closing|Close|Due|Deadline)[^\n]{0,40}?:\s*(\d{4}-\d{2}-\d{2})", re.I),
    re.compile(r"(?:Closing|Close|Due|Deadline)[^\n]{0,40}?:\s*(\d{1,2}/\d{1,2}/\d{2,4})", re.I),
  ]
  closing_date = None
  for pat in date_pats:
    m = pat.search(text)
    if m: closing_date = m.group(1); break

  email_pat = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
  phone_pat = re.compile(r"(?:\+?\d{1,2}\s*)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})")
  money_pat = re.compile(r"\$\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?")

  org_guess = None
  for kw in ["Government of", "City of", "Province of", "County of", "Town of", "Canada", "CanadaBuys"]:
    i = text.find(kw)
    if i != -1:
      org_guess = text[i:i+120].splitlines()[0].strip()
      break

  resp = {
    "ok": True,
    "filename": filename,
    "pages": pages,
    "word_count": len(compact.split()),
    "closing_date_guess": closing_date,
    "contact_emails": find_all(email_pat, text, 5),
    "contact_phones": find_all(phone_pat, text, 5),
    "budget_mentions": find_all(money_pat, text, 5),
    "buyer_guess": org_guess,
    "title_guess": next((ln.strip() for ln in first_page.splitlines() if ln.strip() and len(ln.strip()) < 140), None),
    "highlights": top_sentences(text, 6),
  }
  return (json.dumps(resp, indent=2), 200, headers)
