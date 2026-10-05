"""Make the calm background music for The Quantum Diary (app/static/diary/ambient.json).

A slow phrase in a soft pentatonic scale (notes picked with saved IBM hardware randomness from data/qrng) is
given to qrc-midi-v1; the quantum reservoir learns it and writes a new, longer melody. The site plays that
melody gently over slow pad chords. Run once (5 credits): python tools/make_ambient.py
"""
import glob
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from app.atlas import AtlasClient  # noqa: E402
from app.midi import read_midi, write_midi  # noqa: E402
from app.server import load_key  # noqa: E402

BPM = 60
SCALE = [60, 62, 64, 67, 69, 72, 74, 76]   # C major pentatonic: no clashing notes
LENGTHS = [1, 1, 1.5, 2, 2, 3]
OUT = os.path.join(ROOT, "app", "static", "diary", "ambient.json")


def seed_phrase():
    pool = json.load(open(sorted(glob.glob(os.path.join(ROOT, "data", "qrng", "pool-*.json")))[1]))
    f, notes, t, step = pool["floats"], [], 0.0, 3
    for i in range(32):
        step = max(0, min(len(SCALE) - 1, step + int(f[2 * i] * 5) - 2))   # small steps, like humming
        length = LENGTHS[int(f[2 * i + 1] * len(LENGTHS)) % len(LENGTHS)]
        notes.append([t, length, SCALE[step], 60])
        t += length
    return notes, pool["provenance"]


def main():
    notes, prov = seed_phrase()
    atlas = AtlasClient(load_key())
    asset = atlas.upload(write_midi(notes, BPM), "ambient.mid", "audio/midi")
    params = {"bpm": BPM, "length": 64, "quality": "fast", "seed": 2026, "velocity": 60}
    jid, t0 = atlas.submit("qrc-midi-v1", params, {"midi": asset}), time.time()
    while (st := atlas.status(jid)["status"]) not in ("completed", "failed", "cancelled"):
        time.sleep(2)
    if st != "completed":
        sys.exit(f"qrc-midi-v1: {st}")
    out = read_midi(atlas.result_bytes(jid))
    print(f"done after {time.time() - t0:.0f}s: {len(out)} notes, pitches {sorted({n[2] for n in out})}")
    json.dump({"engine": "qrc-midi-v1", "job_id": jid, "params": params, "seed_phrase": notes,
               "seed_randomness": {"engine": prov.get("engine"), "job_id": prov.get("job_id")},
               "bpm": BPM, "notes": out}, open(OUT, "w"), separators=(",", ":"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
