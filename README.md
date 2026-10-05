# The Quantum Diary

*Your mind, measured.* A diary where every entry becomes a living brain map and its own song, made with
Moth Quantum's Atlas engines. Built for Moth Hack 2026.

## What it does

1. **You write how your day was.** While you type, the diary records *how* you type: speed, force,
   pauses, deletions and rhythm.
2. **It reads your words and your fingers separately.** Feelings come from transparent word lists (with
   "not happy" counted as sad). Typing suggests its own mood ("energetic", "tense", "low"…). The two don't
   always agree, and that's the point: your fingers can show what you didn't write.
3. **The quantum engines make the art and the music:**
   - **`graph-v1`** (Quantum Graph): the entry's key moments become qubits and their links a coupling map.
     The measured two-qubit correlations set how strongly each pair of thoughts is connected in the brain
     map, and the Bloch vectors shape where each moment sits.
   - **`qrc-midi-v1`** (Quantum Reservoir Computing): your typing becomes a melody (letters → notes, pauses →
     note lengths, in the scale of your feeling). The quantum reservoir learns it and writes the day's song.
     Sad entries get a slow minor song, with chords picked to fit the notes the reservoir wrote.
   - **`blur-core-v1`** (Quantum Blur): screens and text appear through real quantum-blur frames, seeded with
     real IBM hardware randomness from `comet-qrng-v1`.
   - The calm background music is also a `qrc-midi-v1` composition.
4. **Two ways to read it back:** a flip-book diary of your pages, and the **quantum diary**, where each day
   is a living brain map that fires along with its song. **My week** adds a mood timeline, a merged week
   brain map, the week's song and a just-for-fun quantum mood forecast.
5. **Save song** (.wav) and **Record video** (.webm of the brain map with its song).

## Privacy

Your diary text never leaves your device. It is analysed in the browser and stored in the browser's
`localStorage`. Only numbers go to the server: the number of moments and their links (for `graph-v1`)
and the melody notes (for `qrc-midi-v1`). The Atlas API key stays on the server and is never sent to the
browser.

## Run it locally

```
pip install -r requirements-dev.txt
echo MOTH_API_KEY=your-key > .env
python -m uvicorn app.server:app --reload
```

Then open http://127.0.0.1:8000 (it goes to `/diary/`). Add `?example` and open **My week** to see an
example week without writing seven entries. Tests (fake Atlas, no credits): `python -m pytest -q tests`.

## Code

- `app/server.py`: FastAPI server. `/api/diary/graph` → `graph-v1`, `/api/diary/song` → `qrc-midi-v1`,
  job status/result proxies, rate limits.
- `app/atlas.py`: Atlas API client (presigned uploads, submit, poll, results, retries).
- `app/static/diary/`: the diary (plain JavaScript modules, no build step). `analyse.js` (typing + feelings),
  `music.js` (melody, songs, player), `brainmap.js` (the living map), `week.js`, `reveal.js` (quantum blur
  transitions), `ambient.js`, `theme.js` + `studio.html` (Design Studio for every visual choice).
- `tools/make_reveal.py`, `tools/make_ambient.py`: the one-off engine runs behind the transitions and the
  background music. `data/qrng/` holds the IBM hardware randomness (`comet-qrng-v1`) they were seeded with.

## Credits

Quantum engines by [Moth Quantum](https://mothquantum.com) Atlas. Page turns by
[StPageFlip](https://github.com/Nodlik/StPageFlip) (MIT). Word finding by
[compromise](https://github.com/spencermountain/compromise) (MIT). Built with help from Claude (Anthropic)
as a coding assistant.
