// Calm background music to think to. The melody was written by Moth's qrc-midi-v1 quantum reservoir from a slow
// pentatonic phrase (ambient.json, made by tools/make_ambient.py); here it plays softly over slow pad chords.
// It fades out whenever a diary song is playing, and fades back in after.
const BPM = 44, LEVEL = 0.22;
// pad chord for each melody note (all inside C major pentatonic, so nothing clashes)
const CHORDS = { C: [48, 55, 64], Am: [45, 52, 60], G: [43, 50, 62] };
const CHORD_OF = { 60: "C", 64: "C", 67: "C", 72: "C", 76: "C", 69: "Am", 62: "G", 74: "G" };

export class Ambient {
  constructor(player) {
    this.player = player; this.ctx = null; this.on = false; this.timer = null;
    this.song = fetch("ambient.json").then((r) => r.json()).catch(() => null);
    setInterval(() => this.level(), 300);   // duck under the diary's own songs
    document.addEventListener("visibilitychange", () => { if (this.ctx) document.hidden ? this.ctx.suspend() : this.on && this.ctx.resume(); });
  }

  async start() {
    if (this.on) return;
    const song = await this.song; if (!song) return;
    this.on = true;
    const ctx = this.ctx || (this.ctx = new AudioContext()); ctx.resume();
    if (!this.master) {
      this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
      const verb = ctx.createConvolver(), len = ctx.sampleRate * 4.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2; }
      verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.7; verb.connect(wet).connect(this.master);
      this.verb = verb;
    }
    this.bus = ctx.createGain(); this.bus.gain.value = 0.6; this.bus.connect(this.master); this.bus.connect(this.verb);   // fresh each start
    const spb = 60 / BPM, end = Math.ceil(Math.max(...song.notes.map((n) => n[0] + n[1])) / 8) * 8, loop = end * spb;
    let next = ctx.currentTime + 0.2;
    const schedule = () => {
      if (ctx.currentTime > next) next = ctx.currentTime + 0.1;
      if (next - ctx.currentTime > 2) return;
      for (const [s, d, p] of song.notes) this.bell(next + s * spb, p, d * spb);
      for (let bar = 0; bar < end; bar += 8) {   // one chord every 8 beats, from the melody note that starts the bar
        const first = song.notes.find((n) => n[0] >= bar) || song.notes[0];
        this.pad(next + bar * spb, CHORDS[CHORD_OF[first[2]] || "C"], 8 * spb);
      }
      next += loop;
    };
    schedule(); this.timer = setInterval(schedule, 500);
    this.level();
  }

  stop() {
    this.on = false; clearInterval(this.timer); this.timer = null; this.level();
    const old = this.bus; setTimeout(() => old && old.disconnect(), 1000);   // silence notes already queued
  }
  toggle() { if (this.on) { this.stop(); return Promise.resolve(); } return this.start(); }

  level() {
    if (!this.master) return;
    const target = this.on && !(this.player && this.player.playing) ? LEVEL : 0, now = this.ctx.currentTime;
    if (this.target === target) return;
    this.target = target;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + (target ? 3 : 0.8));
  }

  bell(t, midi, dur) {   // soft felt-piano / glass tone
    const ctx = this.ctx, f = 440 * 2 ** ((midi - 69) / 12), g = ctx.createGain(), lp = ctx.createBiquadFilter(), len = Math.max(2.5, dur + 2);
    lp.type = "lowpass"; lp.frequency.value = 1600; g.connect(lp).connect(this.bus);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    for (const [type, mul, lvl] of [["triangle", 1, 1], ["sine", 2, 0.18]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = lvl;
      o.connect(og).connect(g); o.start(t); o.stop(t + len + 0.1);
    }
  }

  pad(t, notes, dur) {   // slow-breathing chord
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(), fade = Math.min(3, dur / 2.5), len = dur + fade;
    lp.type = "lowpass"; lp.frequency.value = 650; g.connect(lp).connect(this.bus);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + fade); g.gain.setValueAtTime(0.035, t + dur); g.gain.linearRampToValueAtTime(0, t + len);
    for (const m of notes) for (const det of [-4, 4]) {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 440 * 2 ** ((m - 69) / 12); o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + len + 0.1);
    }
  }
}
