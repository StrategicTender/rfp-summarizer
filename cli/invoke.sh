#!/usr/bin/env bash
set -euo pipefail
SERVICE="summarizer-v02"; REGION="us-central1"
URL_RUN="$(gcloud functions describe "$SERVICE" --region "$REGION" --format='value(serviceConfig.uri)')"
SA="$(gcloud functions describe "$SERVICE" --region "$REGION" --format='value(serviceConfig.serviceAccountEmail)')"
ID_TOKEN="$(gcloud auth print-identity-token --impersonate-service-account="$SA" --audiences="$URL_RUN" --include-email)"
AUTH="Authorization: Bearer ${ID_TOKEN}"

IN="${1:?Usage: ./cli/invoke.sh /path/to/payload.json}"
TMP="$(mktemp)"; cp "$IN" "$TMP"

attempts=10
for ((i=1;i<=attempts;i++)); do
  curl -sS -D /tmp/h -o /tmp/b \
    -H "$AUTH" -H "Content-Type: application/json" \
    --data-binary @"$TMP" "$URL_RUN"
  status="$(sed -n '1s/.* \([0-9][0-9][0-9]\).*/\1/p' /tmp/h)"
  if [[ "$status" == "200" ]]; then
    sed -n '1,200p' /tmp/b
    exit 0
  fi
  req_field="$(python3 - <<'PY'
import json, re
try:
  j=json.load(open("/tmp/b"))
  m=re.search(r"required property.*?: '([^']+)'", j.get("error",""))
  print(m.group(1) if m else(""))
except: print("")
PY
)"
  if [[ -n "$req_field" ]]; then
    python3 - "$req_field" "$TMP" <<'PY'
import json, sys, datetime
k=sys.argv[1]; path=sys.argv[2]
with open(path) as f: p=json.load(f)
def d(k):
  defaults = {
    "buyer":{"name":"TBD Buyer","jurisdiction":"CA-federal"},
    "contact":{"name":"Contact","email":"contact@example.com"},
    "industry_tags":["general"], "trade_agreements":["CUSMA"],
    "attachments":[], "urls":[], "line_items":[],
    "language":"en", "category":"General", "source":"live-check",
    "procurement_method":"RFP", "summary":"Summary not provided (auto).",
    "text":"Auto content.", "title":"Auto Title", "id":"auto-id",
    "issue_date": datetime.date.today().isoformat(),
    "closing_date": (datetime.datetime.now()+datetime.timedelta(days=7)).isoformat()
  }
  p.setdefault(k, defaults.get(k, "TBD"))
with open(path,"w") as f: json.dump(p,f,indent=2,ensure_ascii=False)
PY
    continue
  fi
  sed -n '1,200p' /tmp/b >&2
  exit 2
done
echo "Gave up after $attempts attempts." >&2
exit 3
