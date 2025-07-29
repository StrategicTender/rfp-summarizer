import os
import json
import base64
import chardet
from io import BytesIO # Import BytesIO for PDF processing
from pdfminer.high_level import extract_text as extract_pdf_text
import openai # Using OpenAI as an example LLM provider

# Make sure to set your OpenAI API key in Netlify Environment Variables
# Key: OPENAI_API_KEY, Value: your_api_key_here
openai.api_key = os.environ.get("OPENAI_API_KEY")

def summarize_text(text_content):
    """
    Summarizes the given text content using OpenAI's GPT-3.5-turbo.
    """
    if not openai.api_key:
        raise ValueError("OpenAI API key is not set. Please set OPENAI_API_KEY in Netlify environment variables.")

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo", # Or "gpt-4" for better quality, but higher cost
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes RFP documents concisely. Focus on key requirements, objectives, and deliverables."},
                {"role": "user", "content": f"Please summarize the following RFP document:\n\n{text_content}"}
            ],
            max_tokens=500, # Adjust as needed for summary length (approx 1 token = 4 chars)
            temperature=0.7, # Controls randomness. Lower for more focused, higher for more creative.
        )
        summary = response.choices[0].message.content.strip()
        return summary
    except Exception as e:
        print(f"Error summarizing text with OpenAI: {e}")
        raise

def handler(event, context):
    # Ensure the API key is available before processing
    if not os.environ.get("OPENAI_API_KEY"):
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Server configuration error: OpenAI API key not set."}),
            "headers": {"Content-Type": "application/json"}
        }

    try:
        # Netlify Functions pass JSON body directly if Content-Type is application/json
        body_json = json.loads(event['body'])
        file_content_base64 = body_json.get('fileContent')
        file_type = body_json.get('fileType')
        file_name = body_json.get('fileName', 'unknown_file') # For logging/debugging

        if not file_content_base64 or not file_type:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Missing file content or type in request."}),
                "headers": {"Content-Type": "application/json"}
            }

        file_bytes = base64.b64decode(file_content_base64)
        text_content = ""

        if "pdf" in file_type:
            try:
                # PDF Miner expects a file-like object
                pdf_file_obj = BytesIO(file_bytes)
                text_content = extract_pdf_text(pdf_file_obj)
            except Exception as e:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"message": f"Error processing PDF ({file_name}): {e}"}),
                    "headers": {"Content-Type": "application/json"}
                }
        elif "text" in file_type:
            # Detect encoding to handle various text files
            detection = chardet.detect(file_bytes)
            encoding = detection['encoding'] if detection and detection['confidence'] > 0.8 else 'utf-8'
            try:
                text_content = file_bytes.decode(encoding)
            except UnicodeDecodeError:
                text_content = file_bytes.decode('latin-1') # Fallback for common issues
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": f"Unsupported file type '{file_type}'. Please upload a .txt or .pdf file."}),
                "headers": {"Content-Type": "application/json"}
            }

        if not text_content.strip():
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "The uploaded file is empty or could not be read."}),
                "headers": {"Content-Type": "application/json"}
            }

        # Limit the text sent to the LLM to avoid exceeding token limits
        # and for cost efficiency. Adjust this value as needed.
        # OpenAI's GPT-3.5-turbo-0125 context window is 16,385 tokens.
        # 1 token is roughly 4 characters for English text.
        # So 10000 characters is approximately 2500 tokens, which is well within limits.
        MAX_LLM_INPUT_LENGTH = 10000 # characters
        if len(text_content) > MAX_LLM_INPUT_LENGTH:
            text_content = text_content[:MAX_LLM_INPUT_LENGTH] + "\n... [Content Truncated due to length for summarization]"

        summary = summarize_text(text_content)

        return {
            "statusCode": 200,
            "body": json.dumps({"summary": summary}),
            "headers": {"Content-Type": "application/json"}
        }

    except json.JSONDecodeError:
        return {
            "statusCode": 400,
        "body": json.dumps({"message": "Invalid JSON payload."}),
            "headers": {"Content-Type": "application/json"}
        }
    except ValueError as e:
        # Catch specific ValueErrors (like missing API key)
        return {
            "statusCode": 500,
            "body": json.dumps({"message": str(e)}),
            "headers": {"Content-Type": "application/json"}
        }
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Unhandled error in function: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "An unexpected error occurred. Please try again or contact support."}),
            "headers": {"Content-Type": "application/json"}
        }