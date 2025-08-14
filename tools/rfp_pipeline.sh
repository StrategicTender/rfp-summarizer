#!/usr/bin/env bash
set -euo pipefail

PDF="${1:?Usage: tools/rfp_pipeline.sh /path/to/file.pdf [buyer='Parks Canada'] [jurisdiction='CA-federal'] [tags='services']}"
BUYER="${2:-Parks Canada}"
JURIS="${3:-CA-federal}"
TAGS="${4:-services}"

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# slug for filenames/ids
ID="$(python3 - <<'PY' "$PDF"
import os, re, sys
p=os.path.expanduser(sys.argv[1])
s=os.path.splitext(os.path.basename(p))[0]
print(re.sub(r'[^A-Za-z0-9]+','-',s).strip('-').lower() or 'rfp')
PY
)"
JSON="work/${ID}.json"
OUT="work/out/${ID}.out.json"

# 1) PDF -> JSON (uses pdftotext if present else pypdf)
python3 tools/rfp_from_pdf.py --pdf "$PDF" \
  --id "$ID" --buyer "$BUYER" --jurisdiction "$JURIS" \
  --method RFP --tags "$TAGS" --source "bulk-pdf" > "$JSON"

# 2) Invoke private summarizer
./cli/invoke.sh "$JSON" > "$OUT"

# 3) Make Markdown summary and open it
python3 tools/summarize_out.py "$OUT" >/tmp/summary_path
SUMMARY="$(cat /tmp/summary_path)"
echo "Summary: $SUMMARY"
