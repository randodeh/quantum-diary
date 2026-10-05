"""Minimal client for the Moth Quantum Atlas API (see docs/atlas-api.md).

Server-side only: holds the API key, which must never be logged or returned to the browser.
"""
import time

import requests

API = "https://api.mothquantum.com/api/v1"
# Cloudflare blocks default library User-Agents with 403 "error code: 1010".
USER_AGENT = "one-of-one/1.0 (Moth Hack 2026)"
TRANSIENT = (502, 503, 504)


class AtlasError(Exception):
    """An Atlas call failed. `status` is the upstream HTTP status (0 for network errors)."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


class AtlasClient:
    def __init__(self, key, base=API, timeout=60):
        if not key:
            raise ValueError("MOTH_API_KEY is not set")
        self.base = base
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {key}", "User-Agent": USER_AGENT})

    def _call(self, method, path, **kw):
        r = None
        for attempt in range(4):
            try:
                r = self.session.request(method, f"{self.base}{path}", timeout=self.timeout, **kw)
            except requests.RequestException as e:
                if attempt == 3:
                    raise AtlasError(0, f"network error: {type(e).__name__}") from None
            else:
                if r.status_code not in TRANSIENT:
                    break
            time.sleep(2 ** attempt)
        if r is None or r.status_code >= 400:
            status = r.status_code if r is not None else 0
            # Only the status and a trimmed body; never request headers.
            body = r.text[:200] if r is not None else ""
            raise AtlasError(status, f"{method} {path} -> HTTP {status}: {body}")
        return r.json() if r.content else {}

    def upload(self, data, filename, content_type):
        """Register → PUT to presigned URL → complete. Returns the asset_id."""
        reg = self._call("POST", "/assets", json={
            "filename": filename, "content_type": content_type, "size_bytes": len(data)})
        up = reg["upload"]
        # The presigned URL needs no auth, so use a plain request without our session headers.
        r = requests.put(up["url"], data=data, headers=up.get("headers") or {}, timeout=120)
        if r.status_code >= 400:
            raise AtlasError(r.status_code, f"storage PUT -> HTTP {r.status_code}")
        self._call("POST", f"/assets/{reg['asset_id']}/complete")
        return reg["asset_id"]

    def submit(self, engine, params, input_files):
        job = self._call("POST", f"/engines/{engine}/process",
                         json={"params": params, "input_files": input_files})
        return job["job_id"]

    def status(self, job_id):
        return self._call("GET", f"/jobs/{job_id}/status")

    def result_json(self, job_id):
        """The inline JSON output of a completed job (engines like blur-core-v1)."""
        res = self._call("GET", f"/jobs/{job_id}/result")["result"]
        return res["output"] if isinstance(res, dict) and "output" in res else res

    def result_bytes(self, job_id):
        """Download the first file output of a completed job."""
        res = self._call("GET", f"/jobs/{job_id}/result")
        outs = res["outputs"]
        url = next((o["url"] for o in outs if o.get("slot") == "result"), outs[0]["url"])
        r = requests.get(url, timeout=120)
        if r.status_code >= 400:
            raise AtlasError(r.status_code, f"result download -> HTTP {r.status_code}")
        return r.content
