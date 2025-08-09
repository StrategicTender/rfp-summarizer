from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
from pdfminer.high_level import extract_text
import openai
import os

# Set up FastAPI app
app = FastAPI()

# Allow CORS for frontend access (Netlify, localhost, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Read OpenAI API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

# Define request model
class SummarizeRequest(BaseModel):
    filename: str
    content: str  # base64-encoded file content

# Define response model
class SummarizeResponse(BaseModel):
    summary: str

@app.post("/", response_model=SummarizeResponse)
async def summarize_rfp(request: SummarizeRequest):
    try:
        # Decode base64 to binary
        decoded_bytes = base64.b64decode(request.content)

        # Extract text from PDF
        pdf_stream = io.BytesIO(decoded_bytes)
        extracted_text = extract_text(pdf_stream)

        if not extracted_text.strip():
            return {"summary": "❌ No extractable text found in the document."}

        # Truncate if too long (OpenAI token limit)
        max_chars = 7000
        truncated_text = extracted_text[:max_chars]

        # Send to OpenAI for summarization
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an expert in government procurement. Summarize this RFP document clearly and concisely."},
                {"role": "user", "content": truncated_text}
            ],
            temperature=0.4,
            max_tokens=500,
        )

        summary = response.choices[0].message.content.strip()
        return {"summary": summary}

    except Exception as e:
        return {"summary": f"❌ Error processing file: {str(e)}"}

# Required to run the app when deployed via Cloud Run using `--source`
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080)
