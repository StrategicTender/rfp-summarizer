import json, sys, os
in_path = sys.argv[1] if len(sys.argv)>1 else "work/out/result.out.json"
j = json.load(open(in_path))

def join_list(v): return ", ".join(v) if isinstance(v, list) else (v or "")
echo = j.get("echo", {})

lines = []
lines.append(f"# {j.get('title','(No title)')}")
lines.append("")
lines.append(f"- **ID:** {j.get('id','')}")
lines.append(f"- **Method:** {echo.get('procurement_method','')}")
lines.append(f"- **Category:** {echo.get('category','')}")
lines.append(f"- **Industry tags:** {join_list(j.get('industry_tags',[]))}")
lines.append(f"- **Trade agreements:** {join_list(echo.get('trade_agreements',[]))}")
lines.append(f"- **Closing date:** {j.get('closing_date','')}")
lines.append(f"- **Fit score:** {j.get('score',{}).get('fit','')}")

def bullets(label, items, limit=12):
    if items:
        lines.append(f"\n## {label}")
        for it in items[:limit]:
            if isinstance(it, dict):
                txt = it.get('text') or it.get('title') or json.dumps(it, ensure_ascii=False)
            else:
                txt = str(it)
            lines.append(f"- {txt}")

bullets("Highlights", j.get("highlights",[]))
bullets("Warnings", j.get("warnings",[]))
bullets("Recommended actions", j.get("actions",[]))

out_path = in_path.replace(".out.json",".summary.md")
with open(out_path, "w") as f: f.write("\n".join(lines) + "\n")
print(out_path)
