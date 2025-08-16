# RFP Summarizer — Preview Backend

FastAPI service returning structured JSON for RFP PDFs.
Endpoints:
- GET /healthz
- POST /v1/summarize  (multipart "file" OR form "pdf_url")

Env:
- CORS_ORIGINS: comma-separated list (default "*")
- PREVIEW_SECRET: optional; if set, send header `X-Preview-Secret: <value>`

Deploy target: Cloud Run (service name suggestion: summarize-upgrade)
