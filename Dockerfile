# Single-service image: build the React SPA, then serve it from FastAPI alongside
# the /api routes. One container, one public URL — no CORS, no separate web host.

# --- stage 1: build the frontend ---
FROM node:22-slim AS web
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
# npm install (not ci) tolerates lockfile drift across npm versions and still
# pulls the correct linux-native binaries (vite/rolldown/lightningcss).
RUN npm install --no-audit --no-fund --loglevel=error
COPY apps/web/ ./
RUN npm run build

# --- stage 2: python runtime serving API + built SPA ---
FROM python:3.12-slim
WORKDIR /app

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/src ./src
COPY --from=web /web/dist ./web

ENV PYTHONPATH=/app/src
ENV WEB_DIST=/app/web
ENV ENVIRONMENT=production

EXPOSE 8000
# Shell form so ${PORT} (injected by the host) expands; default 8000 locally.
CMD uvicorn opsmindai.main:app --host 0.0.0.0 --port ${PORT:-8000}
