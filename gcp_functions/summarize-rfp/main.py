import functions_framework
import base64
import os
import openai

from flask import abort

openai.api_key = os.environ.get("OPENAI_API_KEY")

system_prompt = """You are a helpful assistant that summarizes a Request 
for Proposal (RFP) for a Canadian public sector audience.

Highlight the procurement authority, the objective of the solicitation, 
deliverables, and any mandatory requirements. Be concise, use bullet 
points where possible, and write in clear, accessible language.

End with a short note on how suppliers can express interest (e.g., through 
CanadaBuys or MERX)."""

@functions_framework.http
def summarize_rfp(request):
    try:
        request_json = request.get_json(silent=True)

        if not request_json or "file_content" not in request_json:
            return {"error": "Missing 'file_content' in request"}, 400

        file_content_b64 = request_json["file_content"]
        file_bytes = base64.b64decode(file_content_b64)
        input_text = file_bytes.decode("utf-8", errors="ignore")

        prompt = f"{system_prompt}\n\n{text_truncate(input_text)}"

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": input_text}
            ],
            max_tokens=1000,
            temperature=0.3,
        )

        summary = response["choices"][0]["message"]["content"]
        return {"summary": summary}

    except Exception as e:
        return {"error": str(e)}, 500

def text_truncate(text, max_tokens=3000):
    # Approximate token count using 4 chars/token heuristic
    max_chars = max_tokens * 4
    return text[:max_chars]

