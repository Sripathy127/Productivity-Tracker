FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

# A hint for local use; hosting platforms route by $PORT, not by EXPOSE.
EXPOSE 8000

# Most platforms (Render, Railway, Koyeb) inject $PORT and route only to it, so
# the port cannot be hardcoded. `sh -c` is required for the variable to expand;
# the exec-form CMD would pass "${PORT:-8000}" through as a literal string.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
