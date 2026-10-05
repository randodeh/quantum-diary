"""The Quantum Diary web server.

Serves the diary (app/static/diary, the site root redirects there) and talks to the Atlas API so the key
stays server-side. Only numbers reach this server: the entry's moment links (graph-v1) and its typing
melody (qrc-midi-v1). The diary text never leaves the browser.
Run locally:  python -m uvicorn app.server:app --reload
"""
import os
import threading
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.atlas import AtlasClient, AtlasError
from app.midi import read_midi, write_midi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC = os.path.join(ROOT, "app", "static")
JOB_TTL = 24 * 3600
TERMINAL = {"completed", "failed", "cancelled"}
# Each entry makes one graph-v1 job (connections) and one qrc-midi-v1 job (song)
DIARY_PER_IP_PER_HOUR = 30
DIARY_PER_HOUR = 300
MAX_MOMENTS = 16
MAX_LINKS = 48
MAX_SONG_NOTES = 256


def load_key():
    """MOTH_API_KEY from the environment, falling back to .env for local dev. Never printed."""
    key = os.environ.get("MOTH_API_KEY")
    env_path = os.path.join(ROOT, ".env")
    if not key and os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                name, sep, value = line.strip().partition("=")
                if sep and name.strip() == "MOTH_API_KEY":
                    key = value.strip().strip('"').strip("'")
    return key


class RateLimiter:
    """Sliding one-hour window, per IP and global. Protects our Atlas credits."""

    def __init__(self, per_ip, total, window=3600):
        self.per_ip, self.total, self.window = per_ip, total, window
        self.hits = defaultdict(deque)
        self.all = deque()
        self.lock = threading.Lock()

    def allow(self, ip):
        now = time.time()
        with self.lock:
            for q in (self.hits[ip], self.all):
                while q and q[0] < now - self.window:
                    q.popleft()
            if len(self.hits[ip]) >= self.per_ip or len(self.all) >= self.total:
                return False
            self.hits[ip].append(now)
            self.all.append(now)
            return True


def client_ip(request):
    # Behind the host's proxy the real client is the first X-Forwarded-For entry. It can be
    # spoofed, which is why rate limits also have a global cap.
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def create_app(atlas=None):
    app = FastAPI(title="The Quantum Diary", docs_url=None, redoc_url=None)
    state = {"atlas": atlas}
    diary_limiter = RateLimiter(DIARY_PER_IP_PER_HOUR, DIARY_PER_HOUR)
    jobs = {}                  # job_id -> created time; only these IDs are proxied
    lock = threading.Lock()

    def known(job_id):
        with lock:
            now = time.time()
            for jid in [j for j, t in jobs.items() if t < now - JOB_TTL]:
                del jobs[jid]
            return job_id in jobs

    def busy():
        return HTTPException(503, "The quantum lab is busy right now. Please try again in a minute.")

    def get_atlas():
        if state["atlas"] is None:
            state["atlas"] = AtlasClient(load_key())
        return state["atlas"]

    @app.middleware("http")
    async def always_fresh(request, call_next):
        # Browsers must re-check the site's files on every load, so design changes show up straight away
        # (otherwise a cached old theme.js keeps showing the previous look).
        response = await call_next(request)
        if not request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-cache"
        return response

    @app.exception_handler(HTTPException)
    def http_error(request, exc):
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    def diary_submit(request, engine, params, input_files=None):
        if not diary_limiter.allow(client_ip(request)):
            raise HTTPException(429, "That's a lot of entries for one hour. Try again a little later.")
        try:
            job_id = get_atlas().submit(engine, params, input_files or {})
        except AtlasError:
            raise busy() from None
        with lock:
            jobs[job_id] = time.time()
        return {"job_id": job_id, "engine": engine}

    @app.post("/api/diary/graph")
    async def diary_graph(request: Request):
        body = await request.json()
        n, links, seed = (body.get("n"), body.get("links"), body.get("seed")) if isinstance(body, dict) else (None, None, None)
        ok = (isinstance(n, int) and 2 <= n <= MAX_MOMENTS and isinstance(links, list) and 0 < len(links) <= MAX_LINKS
              and all(isinstance(l, list) and len(l) == 2 and all(isinstance(q, int) and 0 <= q < n for q in l) and l[0] != l[1] for l in links)
              and isinstance(seed, int) and 0 <= seed < 2 ** 31)
        if not ok:
            raise HTTPException(400, f"Need n (2–{MAX_MOMENTS}), up to {MAX_LINKS} links as [a, b] pairs, and a seed.")
        return diary_submit(request, "graph-v1", {"mode": "emu", "num_qubits": n, "coupling_map": links, "shots": 1024, "seed": seed})

    @app.post("/api/diary/song")
    async def diary_song(request: Request):
        body = await request.json()
        bpm, notes, velocity, seed = ((body.get("bpm"), body.get("notes"), body.get("velocity"), body.get("seed"))
                                      if isinstance(body, dict) else (None, None, None, None))

        def valid(n):
            return (isinstance(n, list) and len(n) == 4 and all(isinstance(v, (int, float)) for v in n)
                    and 0 <= n[0] <= 256 and 0.05 <= n[1] <= 16 and 24 <= n[2] <= 108 and 1 <= n[3] <= 127)
        if not (isinstance(bpm, (int, float)) and 40 <= bpm <= 200 and isinstance(notes, list) and 4 <= len(notes) <= MAX_SONG_NOTES
                and all(valid(n) for n in notes) and isinstance(velocity, int) and 1 <= velocity <= 127
                and isinstance(seed, int) and 0 <= seed < 2 ** 31):
            raise HTTPException(400, "A song needs a bpm (40–200), 4–256 notes, a velocity (1–127) and a seed.")
        try:
            asset = get_atlas().upload(write_midi(notes, bpm), "diary.mid", "audio/midi")
        except AtlasError:
            raise busy() from None
        params = {"bpm": bpm, "length": max(24, min(64, len(notes))), "quality": "fast", "seed": seed, "velocity": velocity}
        return diary_submit(request, "qrc-midi-v1", params, {"midi": asset})

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str):
        if not known(job_id):
            raise HTTPException(404, "Unknown job.")
        try:
            status = get_atlas().status(job_id)["status"]
        except AtlasError:
            raise busy() from None
        if status not in TERMINAL and status != "queued":
            status = "processing"   # transient worker states such as "fetching"
        return {"status": status}

    @app.get("/api/jobs/{job_id}/values")
    def job_values(job_id: str):
        """graph-v1's measured connections."""
        if not known(job_id):
            raise HTTPException(404, "Unknown job.")
        try:
            return {"values": get_atlas().result_json(job_id)}
        except AtlasError as e:
            if e.status == 409:
                raise HTTPException(409, "Still working.") from None
            raise busy() from None

    @app.get("/api/jobs/{job_id}/notes")
    def job_notes(job_id: str):
        """qrc-midi-v1's song, as notes."""
        if not known(job_id):
            raise HTTPException(404, "Unknown job.")
        try:
            return {"notes": read_midi(get_atlas().result_bytes(job_id))}
        except AtlasError as e:
            if e.status == 409:
                raise HTTPException(409, "Still working.") from None
            raise busy() from None

    # Static files last, so /api routes win.
    app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
    return app


app = create_app()
