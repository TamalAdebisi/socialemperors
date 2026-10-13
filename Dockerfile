# Recipe for the hosted server's container (Railway, Render, ...). See DEPLOY.md.
#
# assets/ is left out (.dockerignore): players download those files from
# Cloudflare R2 instead (SE_ASSETS_URL), which keeps this image small.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SE_BIND_HOST=0.0.0.0 \
    SE_DATA_DIR=/data

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Runs as root on purpose: Railway's volumes are owned by root, so another
# user couldn't write the database to /data.
# gunicorn reads gunicorn.conf.py (1 worker, port from $PORT).
CMD ["gunicorn", "server:app"]
