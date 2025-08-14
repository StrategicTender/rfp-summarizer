import os, json, base64, traceback
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash
from markdown import markdown as md_to_html
from markupsafe import Markup
import requests

try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request as GARequest
except Exception:
    service_account = None

app = Flask(__name__)
app.secret_key = "dev"
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB

BACKEND_URL = os.getenv("BACKEND_URL", "").strip()
BACKEND_AUTH = os.getenv("BACKEND_AUTH", "none").strip().lower()
BACKEND_AUDIENCE = os.getenv("BACKEND_AUDIENCE", "").strip()
GCP_SA_KEY = os.getenv("GCP_SA_KEY", "")
GCP_SA_KEY_FILE = os.getenv("GCP_SA_KEY_FILE", "")

def _md(s: str) -> str:
    return md_to_html(s or "", extensions=["tables","fenced_code","sane_lists"])

def _esc(x): return Markup.escape(str(x))

def _kv_grid(pairs):
    cells = []
    for k, v in pairs:
        if v is None or v == "" or v == []:
            val = "<span class='st-muted'>—</span>"
        elif isinstance(v, list):
            val = "<ul>" + "".join(f"<li>{_esc(i)}</li>" for i in v) + "</ul>"
        else:
            val = _esc(v)
        cells.append(f"""
          <div class="st-meta">
            <div class="st-meta-key">{_esc(k)}</div>
            <div class="st-meta-val">{val}</div>
          </div>
        """)
    return "<div class='st-meta-grid'>" + "".join(cells) + "</div>"

def _try_render_heavy_json(d: dict):
    title = d.get("title") or d.get("buyer") or d.get("project") or d.get("name")
    buyer = d.get("buyer")
    file = d.get("file") or d.get("filename")
    pages = d.get("pages") or d.get("page_count")
    closing = d.get("closing") or d.get("closing_date")
    emails = d.get("emails") or []
    phones = d.get("phones") or []
    budget = d.get("budget_mentions") or d.get("budget") or []
    highlights = d.get("highlights") or d.get("summary_points") or d.get("highlights_md")

    if not any([buyer, pages, closing, emails, phones, budget, highlights]):
        return None

    grid = _kv_grid([
        ("File", file),
        ("Pages", pages),
        ("Closing", closing),
        ("Buyer", buyer),
        ("Emails", emails),
        ("Phones", phones),
        ("Budget Mentions", budget),
    ])

    if isinstance(highlights, list):
        hl_html = "<ul>" + "".join(f"<li>{_esc(h)}</li>" for h in highlights) + "</ul>"
    elif isinstance(highlights, str):
        hl_html = _md(highlights)
    else:
        hl_html = ""

    return f"""
      <div class="st-heavy">
        <h2 class="st-h2">{_esc(title or "RFP")}</h2>
        {grid}
        {"<h3 class='st-h3'>Highlights</h3>"+hl_html if hl_html else ""}
      </div>
    """

def _as_html_from_json(d: dict) -> str:
    special = _try_render_heavy_json(d)
    if special: return special
    def render(v):
        if isinstance(v, dict):
            inner = "".join(f"<div class='st-row'><div class='st-key'>{_esc(k)}</div><div class='st-val'>{render(x)}</div></div>" for k,x in v.items())
            return f"<div class='st-grid'>{inner}</div>"
        if isinstance(v, list):
            return "<ul>" + "".join(f"<li>{render(x)}</li>" for x in v) + "</ul>"
        return _esc(v)
    return "<section class='st-card'>" + render(d) + "</section>"

def _render_summary_to_html(raw):
    if isinstance(raw, dict):
        return _as_html_from_json(raw)
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8", "ignore")
    if isinstance(raw, str):
        try:
            obj = json.loads(raw)
            if isinstance(obj, (dict, list)):
                return _as_html_from_json(obj if isinstance(obj, dict) else {"data": obj})
        except Exception:
            pass
        return _md(raw)
    return f"<pre>{_esc(raw)}</pre>"

def _error_panel(title: str, detail: str):
    md = f"## {title}\n\n```\n{detail.strip()}\n```"
    return _md(md)

def _id_token_via_sa(audience: str) -> str:
    if not audience:
        raise RuntimeError("BACKEND_AUDIENCE is required for authenticated calls.")
    info = None
    if GCP_SA_KEY:
        info = json.loads(GCP_SA_KEY)
    elif GCP_SA_KEY_FILE and os.path.exists(GCP_SA_KEY_FILE):
        with open(GCP_SA_KEY_FILE, "r") as f:
            info = json.load(f)
    else:
        raise RuntimeError("Service account not provided. Set GCP_SA_KEY or GCP_SA_KEY_FILE.")
    if service_account is None:
        raise RuntimeError("google-auth not installed")
    creds = service_account.IDTokenCredentials.from_service_account_info(info, target_audience=audience)
    creds.refresh(GARequest())
    return creds.token

def summarize_pdf(file_bytes: bytes, filename: str):
    # If BACKEND_URL isn't set, return a demo markdown so UI always works.
    if not BACKEND_URL:
        return (
            f"# {filename}\n\n"
            "- **ID:** (demo)\n"
            "- **Method:** RFP\n"
            "- **Category:** —\n"
            "- **Industry tags:** services\n"
            "- **Closing date:** —\n"
            "- **Fit score:** 60\n"
        )
    try:
        payload = {
            "filename": filename,
            "pdf_base64": base64.b64encode(file_bytes).decode("ascii"),
            "options": {"format": "heavy"},
        }
        headers = {"Content-Type": "application/json"}
        if BACKEND_AUTH == "sa":
            token = _id_token_via_sa(BACKEND_AUDIENCE)
            headers["Authorization"] = f"Bearer {token}"

        resp = requests.post(BACKEND_URL, data=json.dumps(payload), headers=headers, timeout=180)
        ct = (resp.headers.get("Content-Type") or "").lower()
        if resp.status_code >= 400:
            return _error_panel(f"Backend error {resp.status_code}", resp.text)
        if "application/json" in ct:
            try:
                return resp.json()
            except Exception:
                return resp.text
        return resp.text
    except Exception:
        return _error_panel("Local error while calling backend", traceback.format_exc())

@app.get("/")
def index():
    return render_template("index.html", now=datetime.now())

@app.post("/upload")
def upload():
    if "file" not in request.files:
        flash("No file uploaded.")
        return redirect(url_for("index"))
    f = request.files["file"]
    if not f.filename:
        flash("Please choose a file.")
        return redirect(url_for("index"))
    data = f.read()
    try:
        raw = summarize_pdf(data, f.filename)
        html = _render_summary_to_html(raw)
        return render_template("result.html", html=Markup(html))
    except Exception:
        html = _md("## Unhandled error\n\n```\n"+traceback.format_exc()+"\n```")
        return render_template("result.html", html=Markup(html)), 500

@app.get("/health")
def health():
    return {"ok": True, "time": datetime.utcnow().isoformat(), "backend_url": BACKEND_URL, "auth": BACKEND_AUTH}

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8888)
