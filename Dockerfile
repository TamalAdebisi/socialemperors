# Recipe for the hosted server's container (Railway, Render, ...). See DEPLOY.md.
#
# assets/ is left out (.dockerignore): players download those files from
# Cloudflare R2 instead (SE_ASSETS_URL), which keeps this image small.

# 1. The new game client (client/, CLIENT.md), built with Node. Only what it
#    builds (client/dist) goes into the server's image.
FROM node:22-slim AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# 2. The server.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SE_BIND_HOST=0.0.0.0 \
    SE_DATA_DIR=/data

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=client /client/dist client/dist

# Runs as root on purpose: Railway's volumes are owned by root, so another
# user couldn't write the database to /data.
# gunicorn reads gunicorn.conf.py (1 worker, port from $PORT).
CMD ["gunicorn", "server:app"]
