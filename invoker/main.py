import os, json, urllib.request, urllib.error
import functions_framework
from flask import Request, make_response
from google.auth.transport.requests import Request as GReq
from google.oauth2 import id_token

TARGET_URL = os.environ["TARGET_URL"]
APP_SECRET = os.environ["APP_SECRET"]
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-App-Secret"
    resp.headers["Vary"] = "Origin"
    return resp

@functions_framework.http
def invoke(req: Request):
    if req.method == "OPTIONS":
        return _cors(make_response(("", 204)))

    if req.headers.get("X-App-Secret") != APP_SECRET:
        return _cors(make_response((json.dumps({"ok": False, "error": "unauthorized"}), 401, {"Content-Type": "application/json"})))

    try:
        payload = req.get_json(force=True, silent=False)
    except Exception:
        return _cors(make_response((json.dumps({"ok": False, "error": "invalid json"}), 400, {"Content-Type": "application/json"})))

    # Mint ID token (aud = TARGET_URL)
    tok = id_token.fetch_id_token(GReq(), TARGET_URL)

    data = json.dumps(payload).encode("utf-8")
    fwd = urllib.request.Request(
        TARGET_URL, data=data, method="POST",
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(fwd, timeout=60) as r:
            body = r.read()
            resp = make_response((body, r.status, {"Content-Type": r.headers.get("Content-Type", "application/json")}))
            return _cors(resp)
    except urllib.error.HTTPError as e:
        err = e.read()
        resp = make_response((err, e.code, {"Content-Type": "application/json"}))
        return _cors(resp)
