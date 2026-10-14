"""
Smaller downloads: text the server sends (the game's config, the new
client's script and styles, a town) goes gzip-compressed to browsers that
say they can unpack it, which is all of them. JSON and JavaScript shrink to
about a tenth, so the game opens sooner, most of all on phones.

    compress.install(app)

The same text is often sent again (the config, the same for everybody, at
every start), so the last few compressed copies are kept, by their
contents, and not compressed twice. Pictures, sounds and Flash files are
compressed already: they go as they are.
"""

import gzip
import hashlib
import threading
from collections import OrderedDict

from flask import Flask, Response, request

COMPRESSED_TYPES = {
    "application/json", "application/javascript", "text/javascript",
    "text/css", "text/html", "text/plain", "image/svg+xml", "application/xml", "text/xml",
}
# Smaller than this, the packing costs more than it saves.
SMALLEST = 1024
# Copies kept, and how big a text may be to be kept (a town; the config is about 2 MB).
KEPT = 16
KEEP_UP_TO = 8 * 1024 * 1024

_kept: "OrderedDict[bytes, bytes]" = OrderedDict()
_lock = threading.Lock()


def install(app: Flask) -> None:
    app.after_request(compressed)


def compressed(response: Response) -> Response:
    if (response.status_code != 200
            or response.mimetype not in COMPRESSED_TYPES
            or "Content-Encoding" in response.headers
            or "gzip" not in request.headers.get("Accept-Encoding", "").lower()):
        return response
    # A file from disk is passed straight through; read it to pack it.
    response.direct_passthrough = False
    data = response.get_data()
    if len(data) < SMALLEST:
        return response
    response.set_data(_gzip(data))
    response.headers["Content-Encoding"] = "gzip"
    response.vary.add("Accept-Encoding")
    # A file's version tag stays, marked weak (the same file, packed), as
    # nginx does: browsers still ask "changed?" and get a short "no".
    if response.headers.get("ETag"):
        etag, _ = response.get_etag()
        response.set_etag(etag, weak=True)
    return response


def _gzip(data: bytes) -> bytes:
    if len(data) > KEEP_UP_TO:
        return gzip.compress(data, compresslevel=6, mtime=0)
    key = hashlib.sha256(data).digest()
    with _lock:
        if key in _kept:
            _kept.move_to_end(key)
            return _kept[key]
    packed = gzip.compress(data, compresslevel=6, mtime=0)
    with _lock:
        _kept[key] = packed
        while len(_kept) > KEPT:
            _kept.popitem(last=False)
    return packed
