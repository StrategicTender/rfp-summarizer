import base64
import json
import os
from pdfminer.high_level import extract_text
import openai
import chardet
from io import BytesIO

# Initialize OpenAI client (adjust based on your installed 'openai' library version)
openai.api_key = os.environ.get("OPENAI_API_KEY")

def handler(event, context):
    # Basic check for API key presence
    if not os.environ.get("OPENAI_API_KEY"):
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Server configuration error: OpenAI API key not set."}),
            "headers": {"Content-Type": "application/json"}
        }

    try:
        body = json.loads(event['body'])
        filename = body.get('fileName', 'unknown_file')
        filedata_b64 = body.get('fileContent')
        file_type = body.get('fileType')

        if not filedata_b64:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "No file content provided."}),
                "headers": {"Content-Type": "application/json"}
            }

        file_bytes = base64.b64decode(filedata_b64)
        extracted_text = ""

        if "pdf" in file_type:
            try:
                pdf_file_obj = BytesIO(file_bytes)
                extracted_text = extract_text(pdf_file_obj)
            except Exception as e:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"message": f"Error processing PDF ({filename}): {e}"}),
                    "headers": {"Content-Type": "application/json"}
                }
        elif "text" in file_type:
            detected = chardet.detect(file_bytes)
            encoding = detected['encoding'] if detected and detected['confidence'] > 0.8 else 'utf-8'
            try:
                extracted_text = file_bytes.decode(encoding)
            except UnicodeDecodeError:
                extracted_text = file_bytes.decode('latin-1')
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": f"Unsupported file type '{file_type}'. Please upload a .txt or .pdf file."}),
                "headers": {"Content-Type": "application/json"}
            }

        if not extracted_text.strip():
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "The uploaded file is empty or could not be read."}),
                "headers": {"Content-Type": "application/json"}
            }

        MAX_LLM_INPUT_LENGTH = 10000
        if len(extracted_text) > MAX_LLM_INPUT_LENGTH:
            extracted_text = extracted_text[:MAX_LLM_INPUT_LENGTH] + "\n... [Content Truncated due to length for summarization]"

        if openai.api_key:
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that summarizes RFP documents concisely. Focus on key requirements, objectives, and deliverables."},
                    {"role": "user", "content": f"Please summarize the following RFP document:\n\n{extracted_text}"}
                ],
                max_tokens=500,
                temperature=0.7,
            )
            summary = response.choices[0].message.content.strip()
        else:
            raise ValueError("OpenAI API key is not configured for the function.")

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"summary": summary})
        }

    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Invalid JSON payload."}),
            "headers": {"Content-Type": "application/json"}
        }
    except ValueError as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"message": str(e)}),
            "headers": {"Content-Type": "application/json"}
        }
    except Exception as e:
        print(f"Unhandled error in function: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "An unexpected error occurred. Please try again or contact support."}),
            "headers": {"Content-Type": "application/json"}
        }