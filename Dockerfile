FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app/backend PORT=8080
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && groupadd --system --gid 10001 brandlint \
    && useradd --system --uid 10001 --gid 10001 --create-home brandlint
COPY backend/app/ backend/app/
COPY backend/scripts/ backend/scripts/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY demo/ /app/demo/
RUN mkdir -p /app/data/storage/documents /app/backend/.dev_outbox /mnt/documents \
    && chown -R 10001:10001 /app /mnt/documents
USER 10001:10001
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --app-dir /app/backend --host 0.0.0.0 --port ${PORT:-8080} --no-proxy-headers"]

