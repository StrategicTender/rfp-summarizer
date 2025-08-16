from typing import Dict
import textwrap, regex

def heuristic_summary(full_text: str) -> Dict[str, str]:
    # Take the most informative 5-7 sentences (very lightweight scoring)
    sentences = regex.split(r"(?<=[.?!])\s+(?=[A-Z(])", full_text.strip())
    head = " ".join(sentences[:6]).strip() if sentences else ""

    why = []
    if regex.search(r"standing offer|supply arrangement|multi-?year", full_text, regex.I):
        why.append("Potential for multi-year revenue via standing offer/supply arrangement.")
    if regex.search(r"option(?:s)? to extend|extension", full_text, regex.I):
        why.append("Includes options to extend the term.")
    if regex.search(r"mandatory|must", full_text, regex.I):
        why.append("Contains strict mandatory requirements—screen carefully.")
    if regex.search(r"indigenous|aboriginal|set-?aside", full_text, regex.I):
        why.append("May include Indigenous procurement considerations.")
    if regex.search(r"bond|security|insurance", full_text, regex.I):
        why.append("Financial security/insurance requirements likely apply.")

    # Naive fit score: presence of common Strategic Tender domains
    score = 50
    bumps = [
        (r"services?", +10),
        (r"maintenance|support|rentals?", +10),
        (r"training|implementation", +5),
        (r"mandatory", -5),
        (r"experience\s+in", -5),
        (r"security\s+clearance|reliability|criminal", -10),
    ]
    for pat, delta in bumps:
        if regex.search(pat, full_text, regex.I):
            score += delta
    score = max(0, min(100, score))

    return {
        "executive": textwrap.shorten(head or "No summary extracted from the document.", width=800, placeholder="…"),
        "why_it_matters": " ".join(why) or "Standard public solicitation; evaluate scope, dates, and mandatory items.",
        "fit_score": {"score": score, "rationale": f"Heuristic score based on content signals; adjust with client context."}
    }
