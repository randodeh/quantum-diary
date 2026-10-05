"""Make the "Quantum blur" screen animation for The Quantum Diary (app/static/diary/reveal.json).

A few seed points are placed on a 32x32 grid using real IBM hardware randomness (a saved comet-qrng-v1 pool
in data/qrng), then blur-core-v1 blurs that grid at rising strengths. Each blurred grid is one frame: when
a screen or text appears, it shows through these shapes, spreading out the way the quantum blur spreads.
Run once (about 10 credits): python tools/make_reveal.py
"""
import glob
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app.atlas import AtlasClient  # noqa: E402
from app.server import load_key  # noqa: E402

N = 32
SEEDS = 6
STRENGTHS = [0.04, 0.08, 0.13, 0.19, 0.26, 0.34, 0.44, 0.56, 0.72, 0.9]
PARAMS = {"reach": 0.15, "shots": 4096}   # shot noise gives the spreading edge its grain
OUT = os.path.join(ROOT, "app", "static", "diary", "reveal.json")


def seed_grid():
    pool = json.load(open(sorted(glob.glob(os.path.join(ROOT, "data", "qrng", "pool-*.json")))[0]))
    f = pool["floats"]
    grid = [[0.0] * N for _ in range(N)]
    points = []
    for i in range(SEEDS):
        r, c = int(f[2 * i] * N) % N, int(f[2 * i + 1] * N) % N
        grid[r][c] = 1.0
        points.append([r, c])
    return grid, points, pool["provenance"]


def main():
    grid, points, prov = seed_grid()
    atlas = AtlasClient(load_key())
    jobs = {s: atlas.submit("blur-core-v1", {"values": grid, "strength": s, **PARAMS}, {}) for s in STRENGTHS}
    frames, t0 = [], time.time()
    for s in STRENGTHS:
        jid = jobs[s]
        while (st := atlas.status(jid)["status"]) not in ("completed", "failed", "cancelled"):
            time.sleep(1)
        if st != "completed":
            sys.exit(f"strength {s}: {st}")
        values = atlas.result_json(jid)
        top = max(max(r) for r in values) or 1
        frames.append({"strength": s, "job_id": jid, "grid": [[round(255 * v / top) for v in r] for r in values]})
        print(f"strength {s}: done after {time.time() - t0:.0f}s", flush=True)
    json.dump({"engine": "blur-core-v1", "params": PARAMS, "size": N, "seed_points": points,
               "seed_randomness": {"engine": prov.get("engine"), "job_id": prov.get("job_id")},
               "frames": frames}, open(OUT, "w"), separators=(",", ":"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
