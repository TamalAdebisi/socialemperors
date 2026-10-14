"""
A stand-in for Supabase Auth, for the tests (test_sign_in.py): the three
calls sign_in.py makes, on a local port, with Discord and Google switched on.

Its /authorize doesn't show Discord's page: it sends the browser straight
back with a code, as if the player had clicked "Authorize", for the player
set in `next_player`. Its /token checks the PKCE secret like Supabase does,
so a code with the wrong secret (one stolen, or planted in someone else's
browser) gets nothing.
"""

import base64
import hashlib
import json
import secrets
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KEY = "sb_publishable_test"


class FakeSupabase:
    def __init__(self):
        self.switched_on = {"discord": True, "google": True}
        self.next_player = {"provider_id": "1001", "name": "tester", "full_name": "Tester"}
        self.flows = {}  # code -> (challenge, provider, player)
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def reply(self, status, body=None, headers=()):
                self.send_response(status)
                for name, value in headers:
                    self.send_header(name, value)
                data = json.dumps(body).encode() if body is not None else b""
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                url = urllib.parse.urlparse(self.path)
                query = dict(urllib.parse.parse_qsl(url.query))
                if url.path == "/auth/v1/settings":
                    if self.headers.get("apikey") != KEY:
                        return self.reply(401, {"msg": "Invalid API key"})
                    return self.reply(200, {"external": dict(fake.switched_on, email=True)})
                if url.path == "/auth/v1/authorize":
                    provider = query.get("provider")
                    if not fake.switched_on.get(provider):
                        return self.reply(400, {"msg": "Unsupported provider: provider is not enabled"})
                    if query.get("code_challenge_method") != "s256" or not query.get("code_challenge"):
                        return self.reply(400, {"msg": "PKCE flow requires code_challenge"})
                    code = secrets.token_hex(8)
                    fake.flows[code] = (query["code_challenge"], provider, dict(fake.next_player))
                    back = query["redirect_to"] + "?" + urllib.parse.urlencode({"code": code})
                    return self.reply(302, headers=[("Location", back)])
                self.reply(404, {"msg": "not found"})

            def do_POST(self):
                url = urllib.parse.urlparse(self.path)
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
                if url.path != "/auth/v1/token" or url.query != "grant_type=pkce":
                    return self.reply(404, {"msg": "not found"})
                flow = fake.flows.pop(body.get("auth_code"), None)  # each code works once
                if flow is None:
                    return self.reply(404, {"error_code": "flow_state_not_found",
                                            "msg": "invalid flow state, no valid flow state found"})
                challenge, provider, player = flow
                digest = hashlib.sha256((body.get("code_verifier") or "").encode()).digest()
                if base64.urlsafe_b64encode(digest).rstrip(b"=").decode() != challenge:
                    return self.reply(400, {"error_code": "bad_code_verifier",
                                            "msg": "code challenge does not match previously saved code verifier"})
                identity = {"provider": provider, "id": player["provider_id"],
                            "identity_data": dict(player, sub=player["provider_id"])}
                return self.reply(200, {"access_token": "not-used", "token_type": "bearer",
                                        "user": {"id": "supabase-" + player["provider_id"], "identities": [identity]}})

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()


if __name__ == "__main__":  # for trying the pages by hand: python tests/fake_supabase.py
    import time
    fake = FakeSupabase()
    print(f"SE_SUPABASE_URL={fake.url} SE_SUPABASE_KEY={KEY}")
    while True:
        time.sleep(3600)
