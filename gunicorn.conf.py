# Production settings for gunicorn (the web server used when hosted).
#   Start with:  gunicorn server:app
#
# workers = 1 is REQUIRED: all villages live in this one process's memory
# (see sessions.py). Threads let it serve many players at once.
import os

bind = f"0.0.0.0:{os.environ.get('PORT', os.environ.get('SE_PORT', '5050'))}"
workers = 1
threads = int(os.environ.get("SE_THREADS", "8"))
timeout = 60
graceful_timeout = 30
accesslog = "-"  # request log to the console, which hosts collect


def worker_exit(server, worker):
    # Last save before the process stops (deploys, restarts, scaling down).
    from sessions import flush
    flush()
