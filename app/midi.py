"""Tiny MIDI helpers for the song step: notes in beats ⇄ Standard MIDI File bytes (type 0, one track)."""
import struct

TPB = 480  # ticks per beat


def _vlq(n):
    out = [n & 0x7F]
    while n > 0x7F:
        n >>= 7
        out.insert(0, (n & 0x7F) | 0x80)
    return bytes(out)


def write_midi(notes, bpm):
    """notes: [(start_beat, length_beats, pitch, velocity)] → MIDI file bytes."""
    events = []
    for start, beats, pitch, vel in notes:
        on, off = round(start * TPB), round((start + beats) * TPB)
        events.append((on, 1, bytes([0x90, int(pitch), int(vel)])))
        events.append((max(on + 1, off), 0, bytes([0x80, int(pitch), 0])))
    events.sort(key=lambda e: (e[0], e[1]))   # at the same tick, note-offs (0) come before note-ons (1)
    data, last = _vlq(0) + b"\xff\x51\x03" + (60_000_000 // int(bpm)).to_bytes(3, "big"), 0
    for tick, _, msg in events:
        data += _vlq(tick - last) + msg
        last = tick
    data += _vlq(0) + b"\xff\x2f\x00"
    return b"MThd" + struct.pack(">IHHH", 6, 0, 1, TPB) + b"MTrk" + struct.pack(">I", len(data)) + data


def _read_vlq(data, i):
    n = 0
    while True:
        b = data[i]
        i += 1
        n = (n << 7) | (b & 0x7F)
        if not b & 0x80:
            return n, i


def read_midi(data):
    """MIDI file bytes → [[start_beat, length_beats, pitch, velocity]] sorted by start (all tracks merged)."""
    tpb = struct.unpack(">H", data[12:14])[0]
    i, notes = 14, []
    while i + 8 <= len(data):
        kind, length = data[i:i + 4], struct.unpack(">I", data[i + 4:i + 8])[0]
        chunk, i = data[i + 8:i + 8 + length], i + 8 + length
        if kind != b"MTrk":
            continue
        j, t, status, on = 0, 0, 0, {}
        while j < len(chunk):
            d, j = _read_vlq(chunk, j)
            t += d
            if chunk[j] & 0x80:
                status = chunk[j]
                j += 1
            if status == 0xFF:
                ln, j = _read_vlq(chunk, j + 1)
                j += ln
            elif status in (0xF0, 0xF7):
                ln, j = _read_vlq(chunk, j)
                j += ln
            else:
                hi = status & 0xF0
                if hi in (0xC0, 0xD0):
                    j += 1
                    continue
                a, b = chunk[j], chunk[j + 1]
                j += 2
                if hi == 0x90 and b > 0:
                    on[a] = (t, b)
                elif hi in (0x80, 0x90) and a in on:
                    st, vel = on.pop(a)
                    notes.append([round(st / tpb, 3), round(max(t - st, 1) / tpb, 3), a, vel])
    return sorted(notes)
