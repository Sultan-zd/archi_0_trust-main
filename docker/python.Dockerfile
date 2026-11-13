# Image Python partagee : API FastAPI, seed des identites, init Keycloak et sniffer.
FROM python:3.12-slim

# tcpdump : scapy en a besoin pour compiler le filtre BPF ("tcp") du sniffer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tcpdump \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

COPY docker/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY ai ./ai
COPY api ./api
COPY scripts ./scripts
COPY scenarios ./scenarios
COPY models ./models
COPY data/processed/demo_flows.json ./data/processed/demo_flows.json

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
