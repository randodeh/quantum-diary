@echo off
title The Quantum Diary - local server (keep this window open)
cd /d "%~dp0"
echo Starting The Quantum Diary...
echo Open http://127.0.0.1:8000/diary/ in your browser. Close this window to stop.
start "" "http://127.0.0.1:8000/diary/"
python -m uvicorn app.server:app --port 8000
pause
