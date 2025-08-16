FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip && pip install -r requirements.txt

COPY . /app

# Cloud Run sets $PORT; default locally is 8080
ENV PORT=8080
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8080"]
