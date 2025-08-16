import os, io, json, datetime, requests
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from models import Meta, Facts, Requirements, RiskAndCompliance, Summary, SummarizeResponse
from extract import pdf_to_text, extract_basic_fields
from summarize import heuristic_summary

APP_NAME = "rfp-summarizer-upgrade"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")]
PREVIEW_SECRET = os.getenv("PREVIEW_SECRET", "")

app = FastAPI(title=APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"service": APP_NAME, "status": "ok"}

@app.get("/healthz")
def health():
    return {"ok": True}

def guard(secret_header: Optional[str]):
    if PREVIEW_SECRET and (secret_header or "") != PREVIEW_SECRET:
        raise HTTPException(status_code=401, detail="Invalid preview secret")

@app.post("/v1/summarize", response_model=SummarizeResponse)
async def summarize(
    file: UploadFile | None = File(default=None),
    pdf_url: str | None = Form(default=None),
    x_preview_secret: str | None = Header(default=None)
):
    guard(x_preview_secret)
    source = ""
    data: bytes | None = None

    if file is not None:
        source = file.filename
        data = await file.read()
    elif pdf_url:
        source = pdf_url
        try:
            r = requests.get(pdf_url, timeout=30)
            r.raise_for_status()
            data = r.content
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch PDF: {e}")
    else:
        raise HTTPException(status_code=400, detail="Provide a PDF file or pdf_url")

    try:
        text = pdf_to_text(data or b"")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")

    basics, _lines = extract_basic_fields(text)

    meta = Meta(source=source, processed_at=datetime.datetime.utcnow().isoformat() + "Z")
    facts = Facts(
        title=basics["title"],
        buyer=basics["buyer"],
        solicitation_id=basics["solicitation_id"],
        procurement_method="",
        closing_date=basics["closing_date"],
        contact={"name":"", "email": basics["contact"]["email"], "phone": basics["contact"]["phone"]},
        budget=basics["budget"],
        contract_term={"start":"","end":"","options":""},
        location={"country":"CA","province":"","city":""},
        key_dates=[],
        attachments=[],
        keywords=basics["keywords"]
    )

    requirements = Requirements(
        scope_summary="",
        deliverables=basics["deliverables"],
        eligibility=[],
        mandatory_requirements=basics["mandatory"],
        rated_criteria=basics["rated"],
        submission_instructions=basics["submission"]
    )

    risk = RiskAndCompliance(
        risk_flags=[],
        compliance_flags=[],
        notes=""
    )

    sumdict = heuristic_summary(text)
    summary = Summary(**sumdict)

    return SummarizeResponse(
        meta=meta,
        facts=facts,
        requirements=requirements,
        risk_and_compliance=risk,
        summary=summary
    )
