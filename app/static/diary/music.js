// Your typing becomes a melody, QRC learns it and writes the entry's song, and the browser plays it.

const SCALES = {
  happy: [0, 2, 4, 5, 7, 9, 11], excited: [0, 2, 4, 7, 9], love: [0, 2, 4, 5, 7, 9, 11], hopeful: [0, 2, 4, 6, 7, 9, 11],
  calm: [0, 2, 4, 7, 9], anxious: [0, 1, 3, 5, 7, 8, 10], sad: [0, 2, 3, 5, 7, 8, 10], angry: [0, 1, 3, 5, 6, 8, 10], none: [0, 3, 5, 7, 10],
};   // sad = A natural minor (the minor 6th is what makes it ache)
const ROOT = 57;   // A
const pcOf = (p) => (((p - ROOT) % 12) + 12) % 12;
// nearest note inside the feeling's scale, so every song (even ones saved earlier) stays in its key
const snap = (p, scale) => { for (let d = 0; d < 7; d++) for (const q of [p - d, p + d]) if (scale.includes(pcOf(q))) return q; return p; };
// Sad songs get slow minor chords under the quantum melody. Each bar takes the chord that fits that bar's notes best,
// so the harmony comes from the melody qrc-midi-v1 wrote. Pitch classes counted from A: Am, F, Dm, C, G, Em.
const SAD_CHORDS = [[0, 3, 7], [8, 0, 3], [5, 8, 0], [3, 7, 10], [10, 2, 5], [7, 10, 2]];
// Happy songs (A major): A, E, F#m, D, Bm, C#m — the I–V–vi–IV family
const HAPPY_CHORDS = [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0], [2, 5, 9], [4, 7, 11]];
// three ways a happy song can sound; the user picks one in the Design Studio
export const HAPPY_STYLES = { dreamy: "Dreamy bells", warm: "Warm piano", lofi: "Lo-fi" };
const INSTRUMENT = { happy: "pluck", excited: "pluck", love: "keys", hopeful: "bell", calm: "keys", anxious: "pad", sad: "keys", angry: "saw", none: "keys" };
// What the words say sets the song's feel (tempo range, beat, register); how you typed moves it inside that range.
const FEEL = {
  sad:     { bpm: [56, 74],   beat: "none",  octave: 0 },
  calm:    { bpm: [62, 80],   beat: "none",  octave: 0 },
  love:    { bpm: [70, 90],   beat: "soft",  octave: 0 },
  hopeful: { bpm: [78, 100],  beat: "soft",  octave: 0 },
  none:    { bpm: [70, 100],  beat: "soft",  octave: 0 },
  anxious: { bpm: [88, 116],  beat: "tense", octave: 0 },
  happy:   { bpm: [92, 116],  beat: "full",  octave: 0 },
  excited: { bpm: [112, 140], beat: "full",  octave: 0 },
  angry:   { bpm: [110, 140], beat: "full",  octave: -12 },
};
const feelOf = (mood) => FEEL[mood] || FEEL.none;
// keep any song (including ones saved before this) inside its feeling's tempo range
export const moodTempo = (bpm, mood) => { const [lo, hi] = feelOf(mood).bpm; return Math.round(Math.max(lo, Math.min(hi, bpm))); };

// Each key press = one note: which letter → which step of the mood's scale; the gap before it → how long it lasts.
export function typingMelody(events, mood, stats, text = "") {
  let keys = events.filter((e) => e.kind === "char" || e.kind === "enter");
  if (keys.length < 16 && text) {   // pasted (or barely typed): play the letters of the words at an even, unhurried pace
    let t = 0;
    keys = [...text.slice(0, 400)].filter((c) => /[a-z\n ]/i.test(c)).map((c) => {
      t += c === " " || c === "\n" ? 420 : 200;   // a little breath between words
      return { t, key: c === "\n" ? "" : c, kind: c === "\n" ? "enter" : "char", shift: false };
    }).filter((k) => k.key !== " ");
  }
  const step = Math.max(1, Math.floor(keys.length / 64));           // at most 64 notes
  const picked = keys.filter((_, i) => i % step === 0);
  const gaps = picked.map((k, i) => (i ? Math.min(1500, k.t - picked[i - 1].t) : 200));
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 200;
  const scale = SCALES[mood] || SCALES.none, notes = [];
  const sad = mood === "sad", happy = mood === "happy", top = scale.length * 2;
  let t = 0, walk = sad ? top - 3 : 3;
  picked.forEach((k, i) => {
    const code = k.key ? k.key.toLowerCase().charCodeAt(0) : 32;
    let deg;
    if (sad) {   // sad: each letter moves the tune a small step, drifting downwards like a sigh
      walk += (code % 5) - 2 - (i % 3 === 2 ? 1 : 0);
      if (walk < 0) walk = 2; if (walk > top - 1) walk = top - 3;
      deg = walk;
    } else if (happy) {   // happy: small steps that keep lifting, like humming along
      walk += (code % 5) - 2 + (i % 4 === 3 ? 1 : 0);
      if (walk < 0) walk = 2; if (walk > top - 1) walk = 4;
      deg = walk;
    } else deg = code % top;
    const pitch = ROOT + 12 * Math.floor(deg / scale.length) + scale[deg % scale.length] + (k.shift && !sad && !happy ? 12 : 0);
    const rel = gaps[i + 1] ? gaps[i + 1] / median : 1;
    let len = rel < 0.7 ? 0.25 : rel < 1.4 ? 0.5 : rel < 2.5 ? 0.75 : 1;
    if (sad) len *= 2;   // long, held notes; your pauses still decide which ones
    notes.push([+t.toFixed(2), len, Math.min(96, pitch), 70 + Math.round(stats.force * 50)]);
    t += len;
  });
  const energy = Math.max(0, Math.min(1, 0.6 * Math.min(1, stats.wpm / 90) + 0.4 * stats.force));   // how hard and fast you typed
  const [lo, hi] = feelOf(mood).bpm, bpm = Math.round(lo + (hi - lo) * energy);
  return { bpm, notes, velocity: 70 + Math.round(stats.force * 50) };
}

// AudioBuffer → 16-bit stereo WAV file
export function encodeWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, bytes = 44 + n * ch * 2, view = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, bytes - 8, true); str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true); view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * ch * 2, true); view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let peak = 0; for (const d of data) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  const gain = peak > 0.98 ? 0.98 / peak : 1;
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { view.setInt16(o, Math.max(-1, Math.min(1, data[c][i] * gain)) * 32767, true); o += 2; }
  return new Blob([view], { type: "audio/wav" });
}

export class Player {
  constructor() { this.ctx = null; this.timer = null; this.scheduled = []; }

  // speakers → out → (speakers + a recording tap); dry → out and → reverb → out
  graph(ctx, toSpeakers = true) {
    const out = this.out = ctx.createGain(); out.gain.value = 0.85;
    if (toSpeakers) out.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.3; }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.4; verb.connect(wet).connect(out);
    this.dry = ctx.createGain(); this.dry.connect(out); this.dry.connect(verb);
    return out;
  }

  static shape(song) {
    const spb = 60 / song.bpm, beats = Math.max(4, Math.ceil(Math.max(0, ...song.notes.map((n) => n[0] + n[1])) / 4) * 4);
    return { spb, beats, loop: beats * spb };
  }

  // one pass of the song (melody + beat) starting at time t0
  loopAt(t0, song, mood, force, onNote) {
    const { spb, beats } = Player.shape(song), inst = INSTRUMENT[mood] || "keys", { beat, octave } = feelOf(mood);
    const scale = SCALES[mood] || SCALES.none, sad = mood === "sad";
    if (mood === "happy") return this.happy(t0, song, spb, beats, scale, onNote);
    song.notes.forEach(([s, dur, p, v], i) => {
      this.note(inst, t0 + s * spb, snap(p + octave, scale), sad ? v * 0.7 : v, (sad ? dur * 1.6 : dur) * spb);   // sad: softer and legato
      onNote && onNote(t0 + s * spb, i);
    });
    if (sad) this.sadChords(t0, song, spb, beats, scale);
    if (beat === "none") return;   // sad and calm songs: no drums
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * spb;
      if (beat === "soft") { if (b % 4 === 0) this.kick(t, 0.2 + force * 0.2); continue; }
      if (beat === "tense") { if (b % 4 === 0) this.kick(t, 0.25 + force * 0.3); this.hat(t + spb / 2, 0.2 + force * 0.2); continue; }
      if (b % 2 === 0) this.kick(t, 0.25 + force * 0.5);
      if (force > 0.3 && b % 4 === 2) this.snare(t, force);
      if (force > 0.15) { this.hat(t, 0.35); if (force > 0.45) this.hat(t + spb / 2, 0.25); }
    }
  }

  play(song, mood, force) {
    this.stop();
    song = { ...song, bpm: moodTempo(song.bpm, mood) };
    const ctx = this.ctx || (this.ctx = new AudioContext()); ctx.resume();
    const out = this.graph(ctx);
    this.tap = this.tap || ctx.createMediaStreamDestination();   // lets the page record what you hear
    out.connect(this.tap);
    const { loop } = Player.shape(song);
    let next = ctx.currentTime + 0.1; this.start = next; this.loop = loop; this.scheduled = [];
    const schedule = () => {
      if (ctx.currentTime > next) next = ctx.currentTime + 0.05;   // after sleeping: start fresh, never catch up
      if (next - ctx.currentTime > 1.2) return;
      this.loopAt(next, song, mood, force, (t, i) => this.scheduled.push({ t, i }));
      next += loop;
      this.scheduled = this.scheduled.filter((s) => s.t > ctx.currentTime - 2);
    };
    schedule();
    this.timer = setInterval(schedule, 60);
  }

  // Render the song (twice through, plus a reverb tail) offline into a .wav file, faster than real time.
  async renderWav(song, mood, force, loops = 2) {
    this.stop();
    song = { ...song, bpm: moodTempo(song.bpm, mood) };
    const { loop } = Player.shape(song), sr = 44100, live = this.ctx;
    const off = new OfflineAudioContext(2, Math.ceil((loops * loop + 3) * sr), sr);
    this.ctx = off;
    try {
      const out = this.graph(off); out.connect(off.destination);
      for (let k = 0; k < loops; k++) this.loopAt(0.05 + k * loop, song, mood, force);
      return encodeWav(await off.startRendering());
    } finally { this.ctx = live; this.out = null; }
  }

  // notes that just started playing (for flashing the brain map)
  sounding() { if (!this.ctx || !this.timer) return []; const now = this.ctx.currentTime; return this.scheduled.filter((s) => s.t <= now && now - s.t < 0.35).map((s) => s.i); }
  progress() { return this.ctx && this.timer ? ((this.ctx.currentTime - this.start) % this.loop) / this.loop : -1; }
  stop() { clearInterval(this.timer); this.timer = null; if (this.out) { this.out.gain.value = 0; this.out.disconnect(); this.out = null; } }
  get playing() { return !!this.timer; }

  env(t, peak, a, d, dest) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + a + d); g.connect(dest); return g; }
  osc(type, f, t, dur, dest, level = 1) { const o = this.ctx.createOscillator(), og = this.ctx.createGain(); o.type = type; o.frequency.value = f; og.gain.value = level; o.connect(og).connect(dest); o.start(t); o.stop(t + dur + 0.05); }
  note(inst, t, midi, vel, dur) {
    const f = 440 * 2 ** ((midi - 69) / 12), v = (vel / 127) * 0.15, lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = inst === "saw" ? 2200 : 3000; lp.connect(this.dry);
    if (inst === "keys") { const d = Math.max(0.5, dur + 0.4), g = this.env(t, v, 0.008, d, lp); this.osc("triangle", f, t, d, g); this.osc("sine", f * 2, t, d, g, 0.25); }
    else if (inst === "pluck") { const g = this.env(t, v, 0.003, 0.7, lp); this.osc("sawtooth", f, t, 0.7, g, 0.5); this.osc("sine", f, t, 0.7, g); }
    else if (inst === "bell") { const g = this.env(t, v * 0.8, 0.004, 2.2, lp); this.osc("sine", f, t, 2.2, g); this.osc("sine", f * 2.76, t, 2.2, g, 0.3); }
    else if (inst === "lofi") { const d = Math.max(0.6, dur + 0.5), g = this.env(t, v * 0.9, 0.012, d, lp); lp.frequency.value = 1300; this.osc("triangle", f, t, d, g); this.osc("sine", f * 1.004, t, d, g, 0.6); this.osc("sine", f * 2, t, d, g, 0.08); }
    else if (inst === "pad") { const d = Math.max(1, dur + 0.8), g = this.env(t, v * 0.6, 0.25, d, lp); this.osc("sawtooth", f, t, d, g, 0.4); this.osc("sawtooth", f * 1.006, t, d, g, 0.4); }
    else { const g = this.env(t, v * 0.8, 0.005, Math.max(0.3, dur), lp); this.osc("sawtooth", f, t, Math.max(0.3, dur), g); this.osc("square", f / 2, t, Math.max(0.3, dur), g, 0.3); }
  }
  // one chord per bar (4 beats), picked by how well it fits the melody notes in that bar
  // one chord per bar (4 beats): the chord from the feeling's set that best fits the quantum melody's notes in that bar
  chordsFor(song, beats, scale, set) {
    const out = []; let prev = -1;
    for (let bar = 0; bar < beats; bar += 4) {
      const inBar = song.notes.filter((n) => n[0] >= bar && n[0] < bar + 4);
      let best = 0, bestScore = -Infinity;
      set.forEach((c, k) => {
        let sc = inBar.reduce((s, n) => s + (c.includes(pcOf(snap(n[2], scale))) ? n[1] : 0), 0);
        if (k === prev) sc -= 0.75;            // keep the harmony moving
        if (bar === 0 && k === 0) sc += 1;     // start at home
        if (sc > bestScore) { bestScore = sc; best = k; }
      });
      prev = best; out.push({ bar, chord: set[best] });
    }
    return out;
  }
  happy(t0, song, spb, beats, scale, onNote) {
    const style = HAPPY_STYLES[(globalThis.QD_THEME || {}).happySound] ? globalThis.QD_THEME.happySound : "dreamy";
    const inst = { dreamy: "bell", warm: "keys", lofi: "lofi" }[style];
    song.notes.forEach(([s, dur, p, v], i) => { this.note(inst, t0 + s * spb, snap(p, scale), v * 0.8, dur * spb); onNote && onNote(t0 + s * spb, i); });
    for (const { bar, chord } of this.chordsFor(song, beats, scale, HAPPY_CHORDS)) {
      const t = t0 + bar * spb, len = 4 * spb, mid = chord.map((pc) => 52 + ((pc + 5) % 12)), bass = 40 + ((chord[0] + 5) % 12);
      if (style === "dreamy") { this.strings(t, mid, len); this.note("bell", t, bass + 12, 40, len); }
      else if (style === "warm") {   // piano chords on beats 1 and 3, a walking-ish bass
        for (const b of [0, 2]) for (const m of mid) this.note("keys", t + b * spb, m, 42, 1.6 * spb);
        this.note("keys", t, bass, 62, 2 * spb); this.note("keys", t + 2 * spb, bass + 7 > 52 ? bass - 5 : bass + 7, 52, 2 * spb);
      } else {   // lo-fi: mellow 7th chords held all bar
        const minor = ((chord[1] - chord[0] + 12) % 12) === 3, seventh = 52 + ((chord[0] + (minor ? 10 : 11) + 5) % 12);
        for (const m of [...mid, seventh]) this.note("lofi", t, m, 34, len);
        this.note("keys", t, bass, 55, len);
      }
    }
    for (let b = 0; b < beats; b++) {
      const t = t0 + b * spb, sw = spb * 0.58;   // lo-fi swing
      if (style === "warm") { if (b % 2 === 0) this.kick(t, 0.3); else this.noise(t, 0.12, 0.06, 1200); this.hat(t + spb / 2, 0.16); }
      else if (style === "lofi") {
        if (b % 4 === 0) this.kick(t, 0.32); if (b % 4 === 2) this.kick(t + sw, 0.22);
        if (b % 2 === 1) this.noise(t, 0.16, 0.045, 900);
        this.hat(t, 0.1); this.hat(t + sw, 0.06);
        for (let k = 0; k < 3; k++) this.noise(t + Math.random() * spb, 0.004, 0.03, 2500);   // vinyl crackle
      } else if (b % 8 === 0) this.kick(t, 0.15);   // dreamy: just a soft pulse
    }
  }
  sadChords(t0, song, spb, beats, scale) {
    let prev = -1;
    for (let bar = 0; bar < beats; bar += 4) {
      const inBar = song.notes.filter((n) => n[0] >= bar && n[0] < bar + 4);
      let best = 0, bestScore = -Infinity;
      SAD_CHORDS.forEach((c, k) => {
        let sc = inBar.reduce((s, n) => s + (c.includes(pcOf(snap(n[2], scale))) ? n[1] : 0), 0);
        if (k === prev) sc -= 0.75;            // keep the harmony moving
        if (bar === 0 && k === 0) sc += 1;     // start at home (A minor)
        if (sc > bestScore) { bestScore = sc; best = k; }
      });
      prev = best;
      const t = t0 + bar * spb, len = 4 * spb, chord = SAD_CHORDS[best];
      this.strings(t, chord.map((pc) => 52 + ((pc + 5) % 12)), len);   // E3–D#4
      this.note("keys", t, 40 + ((chord[0] + 5) % 12), 50, len);       // soft low root
    }
  }
  strings(t, notes, len) {   // slow, quiet string pad
    const g = this.ctx.createGain(), lp = this.ctx.createBiquadFilter(), a = Math.min(1, len / 3);
    lp.type = "lowpass"; lp.frequency.value = 900; g.connect(lp).connect(this.dry);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + a); g.gain.setValueAtTime(0.03, t + len - 0.1); g.gain.linearRampToValueAtTime(0, t + len + 0.8);
    for (const m of notes) for (const det of [-5, 5]) {
      const o = this.ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 440 * 2 ** ((m - 69) / 12); o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + len + 0.9);
    }
  }
  kick(t, v) { const o = this.ctx.createOscillator(), g = this.env(t, 0.5 * v, 0.002, 0.28, this.out); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.22); o.connect(g); o.start(t); o.stop(t + 0.35); }
  noise(t, dur, v, hp) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(); s.buffer = buf; f.type = "highpass"; f.frequency.value = hp;
    s.connect(f).connect(this.env(t, v, 0.001, dur, this.out)); s.start(t);
  }
  snare(t, v) { this.noise(t, 0.18, 0.22 * v, 1500); }
  hat(t, v) { this.noise(t, 0.04, 0.07 * v, 7000); }
}
