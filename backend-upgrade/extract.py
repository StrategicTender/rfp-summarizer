import io, re, regex
from typing import Tuple, List
from pypdf import PdfReader

DATE_RX = regex.compile(
    r"(closing|due|submission)\s*(date|deadline)[^\S\r\n]*[:\-]?\s*"
    r"(?P<date>(?:\d{4}[-/]\d{1,2}[-/]\d{1,2})|(?:\d{1,2}\s+\w+\s+\d{4})|(?:\w+\s+\d{1,2},\s*\d{4}))",
    regex.IGNORECASE
)
ID_RX = regex.compile(r"(solicitation|tender|rfp|rfq|itt|reference)\s*(no\.?|#|id)?\s*[:\-]?\s*(?P<id>[A-Z0-9\-_/]{4,})", regex.IGNORECASE)
BUYER_RX = regex.compile(r"(buyer|purchasing|procurement|organization|department)\s*[:\-]\s*(?P<buyer>.+)", regex.IGNORECASE)
EMAIL_RX = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RX = re.compile(r"(\+?\d[\d\-\s().]{7,}\d)")
CURRENCY_RX = re.compile(r"\b(CAD|USD|C\$|\$)\b")
MONEY_RX = re.compile(r"(?<!\w)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)")
TITLE_RX = regex.compile(r"(?m)^\s*(request for.*|rfp.*|rfq.*|tender.*|standing offer.*|proposal.*)$", regex.IGNORECASE)

def pdf_to_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    chunks = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n".join(chunks)

def top_keywords(text: str, k: int = 12) -> List[str]:
    words = regex.findall(r"\b[^\W\d_]{3,}\b", text.lower())
    stop = set("the and for with this that from are was were will would shall into upon about your have not you our any all per his her its may can as is on to of in by or an be it a".split())
    freq = {}
    for w in words:
        if w in stop: continue
        freq[w] = freq.get(w, 0) + 1
    return [w for w,_ in sorted(freq.items(), key=lambda x: (-x[1], x[0]))[:k]]

def extract_basic_fields(text: str) -> Tuple[dict, List[str]]:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    title = ""
    for l in lines[:30]:
        if TITLE_RX.search(l):
            title = l
            break
    # fallback: first non-empty line
    title = title or (lines[0] if lines else "")

    # buyer
    buyer_match = None
    for l in lines[:120]:
        m = BUYER_RX.search(l)
        if m:
            buyer_match = m.group("buyer").strip()
            break

    # id
    m = ID_RX.search(text)
    sol_id = m.group("id").strip() if m else ""

    # closing date
    m = DATE_RX.search(text)
    closing = m.group("date").strip() if m else ""

    # contacts
    emails = EMAIL_RX.findall(text)
    phones = PHONE_RX.findall(text)
    contact = {"name": "", "email": emails[0] if emails else "", "phone": phones[0] if phones else ""}

    # budget (very rough)
    currency = "CAD" if "CAD" in text or "C$" in text or "Canadian" in text else "USD" if "USD" in text else "CAD"
    budget = {"currency": currency, "min": None, "max": None, "notes": ""}

    # rough deliverables/mandatory detection
    def collect(section_names):
        found = []
        rx = regex.compile(r"(?ims)^(?:" + "|".join(section_names) + r")\b.*?(?=^\S|\Z)")
        m = rx.search(text)
        if m:
            for li in regex.findall(r"(?m)^\s*(?:[-*•]\s+|\d+\.\s+)(.+)$", m.group(0)):
                if len(li.strip()) > 3:
                    found.append(li.strip())
        return found[:12]

    deliverables = collect([r"deliverables?", r"scope of work", r"tasks?"])
    mandatory = collect([r"mandatory requirements?", r"minimum requirements?", r"must"])
    rated = collect([r"rated criteria", r"evaluation criteria", r"point-rated"])

    # submission instructions
    submission = collect([r"submission instructions?", r"how to submit", r"proposal submission", r"closing location"])

    return {
        "title": title,
        "buyer": buyer_match or "",
        "solicitation_id": sol_id,
        "closing_date": closing,
        "contact": contact,
        "budget": budget,
        "keywords": top_keywords(text),
        "deliverables": deliverables,
        "mandatory": mandatory,
        "rated": rated,
        "submission": submission
    }, lines
