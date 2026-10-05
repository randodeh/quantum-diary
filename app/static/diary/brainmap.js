// The living brain map for one entry: moments = glowing points, links = connections whose strength was
// measured by the Quantum Graph engine, sparks = signals travelling, all breathing with the song.
import { moodColour } from "./analyse.js";

const colourOf = (mood) => moodColour(mood);   // original feeling colours, or the mandarin fish ones (Design Studio)
const mix = (a, b, p) => a.map((x, j) => Math.round(x * (1 - p) + b[j] * p));
const WHITE = [255, 255, 255];
const seeded = (s) => () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) | 0) >>> 0) / 4294967296;

export class BrainMap {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext("2d"); this.entry = null; this.sparks = []; this.flash = {};
    this.mouse = { x: -1e9, y: -1e9 }; this.t0 = performance.now(); this.running = false;
    addEventListener("resize", () => this.resize());
    canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(), d = this.dpr; this.mouse = { x: (e.clientX - r.left) * d, y: (e.clientY - r.top) * d }; });
    canvas.addEventListener("pointerleave", () => (this.mouse = { x: -1e9, y: -1e9 }));
    this.resize();
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio, 2);
    const r = this.cv.getBoundingClientRect();
    this.W = this.cv.width = Math.max(1, r.width * this.dpr); this.H = this.cv.height = Math.max(1, r.height * this.dpr);
    if (this.entry) this.layout();
  }

  show(entry, player) {
    this.entry = entry; this.player = player; this.sparks = []; this.layout();
    if (!this.running) { this.running = true; requestAnimationFrame((t) => this.frame(t)); }
  }

  layout() {
    const { W, H } = this, ms = this.entry.moments, n = ms.length;
    // a loose ring, each point nudged by its quantum "Bloch" numbers so every map has its own shape
    this.nodes = ms.map((m, i) => {
      const b = this.entry.bloch?.[i] || { X: 0, Y: 0, Z: 0 };
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + b.X * 0.5, r = Math.min(W, H) * (0.3 + 0.1 * b.Z);
      const purity = Math.min(1, Math.hypot(b.X, b.Y, b.Z));
      // "neurons" style: each moment gets its own branching dendrites
      const rnd = seeded((this.entry.seed || 1) + i * 7919), count = 5 + Math.floor(rnd() * 4);
      const dend = Array.from({ length: count }, (_, j) => ({
        a: (j / count) * Math.PI * 2 + rnd() * 0.7, L: 0.7 + rnd() * 0.9, bend: (rnd() - 0.5) * 0.9,
        kids: Array.from({ length: rnd() < 0.85 ? 1 + Math.floor(rnd() * 2) : 0 }, () => ({ at: 0.45 + rnd() * 0.3, da: (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.5), L: 0.3 + rnd() * 0.35 })),
      }));
      return { ...m, bx: W / 2 + Math.cos(a) * r * 1.3, by: H * 0.56 + Math.sin(a) * r * 0.8, x: 0, y: 0, ph: i * 1.7 + b.Y * 3, size: 5 + purity * 7, dend };
    });
    // a faint, deeper web of tiny far-away neurons behind the map
    const rd = seeded((this.entry.seed || 1) * 31 + 5);
    this.dust = Array.from({ length: 90 }, () => ({ x: rd() * W, y: rd() * H, z: 0.25 + rd() * 0.75, ph: rd() * 6.28, m: rd() }));
    this.ripples = [];
  }

  frame(now) {
    if (!this.entry) { this.running = false; return; }
    // look settings chosen in the Design Studio (theme.js); colours come from the page's CSS variables
    const th = window.QD_THEME || {}, motion = +(th.motion ?? 0.5), glow = +(th.glow ?? 0.5), style = th.nodeStyle || "glow";
    const css = getComputedStyle(document.documentElement), v = (n) => css.getPropertyValue(n).trim();
    const { g, W, H } = this, u = W / 1400;
    this.clock = (this.clock || 0) + (this.last ? Math.min(0.1, (now - this.last) / 1000) : 0) * motion; this.last = now;
    const t = this.clock, bpm = this.entry.song?.bpm || 72, breathe = motion ? 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * (bpm / 60) / 4) : 0.5;
    const neuron = style === "neuron", nerve = neuron || (th.connections || "nerve") === "nerve";   // fibres, signals, ripples, far web
    const fire = (k0) => {
      if ((this.flash[k0] || 0) > 0.5) return;
      this.flash[k0] = 1;
      if (!nerve) return;
      this.entry.links.forEach(([a, b], k) => { if (a === k0 || b === k0) this.sparks.push({ k, t: 0, v: 0.011, back: b === k0, big: true }); });
      this.ripples.push({ i: k0, t: 0 });
    };
    for (const i of this.player?.sounding() || []) fire(i % this.nodes.length);
    if (nerve && motion > 0 && Math.random() < 0.012 * motion) fire(Math.floor(Math.random() * this.nodes.length));   // cells fire on their own now and then

    g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, W, H);
    const back = { deepsea: [15, 59, 51], ocean: [12, 20, 19], royal: [27, 47, 168] }[th.mapBackdrop];
    if (back) {   // a dark glow for the cells to shine in, fading into the page
      g.save(); g.translate(W / 2, H * 0.56); g.scale(1, (H / W) * 1.05);   // an oval that fades out before the edges
      const bgr = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.5);
      bgr.addColorStop(0, `rgba(${back},1)`); bgr.addColorStop(0.6, `rgba(${back},.9)`); bgr.addColorStop(1, `rgba(${back},0)`);
      g.fillStyle = bgr; g.fillRect(-W, -W * 2, W * 2, W * 4); g.restore();
    }
    if (glow > 0) {   // soft wash of the day's feelings behind the map (only when glow is chosen)
      (this.entry.feelings?.ranked || []).slice(0, 3).forEach((m, k) => {
        const c = colourOf(m), x = W * (0.3 + 0.2 * k + 0.08 * Math.sin(t * 0.13 + k * 2)), y = H * (0.5 + 0.2 * Math.cos(t * 0.11 + k));
        const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.5); gr.addColorStop(0, `rgba(${c},${0.08 * glow})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      });
    }
    for (const n of this.nodes) {
      const dx = n.bx - this.mouse.x, dy = n.by - this.mouse.y, dist = Math.hypot(dx, dy) || 1, push = Math.max(0, 1 - dist / (W * 0.18)) * W * 0.03;
      n.x = n.bx + Math.sin(t * 0.4 + n.ph) * W * 0.018 + (dx / dist) * push;
      n.y = n.by + Math.cos(t * 0.33 + n.ph * 1.3) * H * 0.022 + (dy / dist) * push;
    }
    if (glow > 0) g.globalCompositeOperation = "lighter";
    if (nerve && this.dust) {   // far-away neurons drifting slowly, joined when close
      const tint = colourOf((this.entry.feelings?.ranked || [])[0] || null), soft = mix(tint, WHITE, 0.35), link = (W * 0.085) ** 2;
      const pos = this.dust.map((d) => [d.x + Math.sin(t * 0.07 + d.ph) * W * 0.02 * d.z, d.y + Math.cos(t * 0.06 + d.ph) * H * 0.02 * d.z]);
      g.lineWidth = 0.7 * u;
      for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
        const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1], d2 = dx * dx + dy * dy;
        if (d2 < link) { g.strokeStyle = `rgba(${soft},${0.1 * (1 - d2 / link) * Math.min(this.dust[a].z, this.dust[b].z)})`; g.beginPath(); g.moveTo(pos[a][0], pos[a][1]); g.lineTo(pos[b][0], pos[b][1]); g.stroke(); }
      }
      this.dust.forEach((d, j) => {
        const tw = 0.5 + 0.5 * Math.sin(t * 1.4 + d.ph * 3);
        g.fillStyle = `rgba(${soft},${(0.12 + 0.3 * tw) * d.z})`; g.beginPath(); g.arc(pos[j][0], pos[j][1], (1 + 2.2 * d.z) * u * 1.4, 0, 7); g.fill();
      });
    }
    const curve = (a, b) => ({ mx: (a.x + b.x) / 2 + Math.sin(t * 0.5 + a.ph) * W * 0.02, my: (a.y + b.y) / 2 + Math.cos(t * 0.5 + b.ph) * H * 0.02 });
    // a point along link k (0 = first node, 1 = second); neurons' fibres wave gently
    const linkPoint = (k, p) => {
      const [a, b] = this.entry.links[k], A = this.nodes[a], B = this.nodes[b], { mx, my } = curve(A, B);
      let x = (1 - p) ** 2 * A.x + 2 * (1 - p) * p * mx + p * p * B.x, y = (1 - p) ** 2 * A.y + 2 * (1 - p) * p * my + p * p * B.y;
      if (nerve) {
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, w = Math.sin(p * Math.PI * 2.5 + A.ph + k + t * 0.8) * Math.sin(p * Math.PI) * len * 0.05;
        x += (-dy / len) * w; y += (dx / len) * w;
      }
      return [x, y];
    };
    if (nerve) this.entry.links.forEach(([a, b], k) => {   // tapered nerve fibres, thick where they leave a cell
      const A = this.nodes[a], B = this.nodes[b]; if (!A || !B) return;
      const s = this.entry.strengths?.[k] ?? 0.5, ca = colourOf(A.mood), cb = colourOf(B.mood), N = 26;
      const al = glow > 0 ? (0.3 + s * 0.55) * (0.8 + 0.2 * Math.sin(t * 1.3 + a + b)) : 0.45 + s * 0.55;
      g.lineCap = "round";
      let [px, py] = linkPoint(k, 0);
      for (let j = 1; j <= N; j++) {
        const p = j / N, [x, y] = linkPoint(k, p);
        g.strokeStyle = `rgba(${mix(ca, cb, p)},${al})`; g.lineWidth = (0.8 + s * 3.4) * u * 1.3 * (1.1 - 0.7 * p);
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); [px, py] = [x, y];
      }
      const [ex, ey] = linkPoint(k, 0.92);   // synapse bulb where the fibre reaches the next cell
      g.fillStyle = `rgba(${mix(cb, WHITE, 0.3)},${Math.min(1, al + 0.25)})`; g.beginPath(); g.arc(ex, ey, (1.6 + s * 2) * u * 1.7, 0, 7); g.fill();
    });
    else this.entry.links.forEach(([a, b], k) => {
      const A = this.nodes[a], B = this.nodes[b]; if (!A || !B) return;
      const s = this.entry.strengths?.[k] ?? 0.5, ca = colourOf(A.mood), cb = colourOf(B.mood), { mx, my } = curve(A, B);
      const al = glow > 0 ? (0.1 + s * 0.5) * (0.75 + 0.25 * Math.sin(t * 1.3 + a + b)) : 0.35 + s * 0.65;
      const gr = g.createLinearGradient(A.x, A.y, B.x, B.y); gr.addColorStop(0, `rgba(${ca},${al})`); gr.addColorStop(1, `rgba(${cb},${al})`);
      g.strokeStyle = gr; g.lineWidth = (0.5 + s * 3.4) * u;
      g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
    });
    // signals travelling along links (stronger links fire more often); none when animation is "still"
    if (motion > 0 && Math.random() < 0.3 && this.entry.links.length) {
      const k = Math.floor(Math.random() * this.entry.links.length);
      if (Math.random() < (this.entry.strengths?.[k] ?? 0.5)) this.sparks.push({ k, t: 0, v: 0.004 + Math.random() * 0.006, back: Math.random() < 0.5 });
    }
    for (const sp of this.sparks) {
      sp.t += sp.v * Math.max(motion, 0.3); let [a, b] = this.entry.links[sp.k]; if (sp.back) [a, b] = [b, a];
      const A = this.nodes[a], B = this.nodes[b], p = sp.t, at = (q) => linkPoint(sp.k, sp.back ? 1 - q : q), [x, y] = at(p);
      const c = colourOf(p < 0.5 ? A.mood : B.mood);
      if (nerve) {
        const size = sp.big ? 1.4 : 1;
        for (let j = 8; j >= 1; j--) {   // tail
          const [tx, ty] = at(Math.max(0, p - j * 0.016));
          g.fillStyle = `rgba(${c},${(1 - j / 9) * 0.7})`; g.beginPath(); g.arc(tx, ty, (4.5 - j * 0.45) * u * 1.6 * size, 0, 7); g.fill();
        }
        const r = 16 * u * size, hg = g.createRadialGradient(x, y, 0, x, y, r);   // head
        hg.addColorStop(0, `rgba(${mix(c, WHITE, 0.8)},1)`); hg.addColorStop(0.35, `rgba(${c},.75)`); hg.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = hg; g.fillRect(x - r, y - r, r * 2, r * 2);
        continue;
      }
      if (glow > 0) { const r = 10 * u * (0.6 + glow * 0.4), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},.9)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      else { g.fillStyle = `rgb(${c})`; g.beginPath(); g.arc(x, y, 3 * u * 1.6, 0, 7); g.fill(); }
    }
    this.sparks = this.sparks.filter((s) => s.t < 1);
    this.nodes.forEach((n, i) => {
      const f = this.flash[i] || 0, c = colourOf(n.mood), r = (n.size + breathe * 4 + f * 10) * u * 2.2;
      if (glow > 0) {
        const gr = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * (2 + 2 * glow));
        gr.addColorStop(0, `rgba(${c},${0.5 + 0.35 * glow})`); gr.addColorStop(0.3, `rgba(${c},${(0.12 + f * 0.3) * glow})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.fillRect(n.x - r * 4, n.y - r * 4, r * 8, r * 8);
      }
      g.fillStyle = `rgb(${c})`; g.strokeStyle = `rgb(${c})`; g.lineWidth = 2 * u * 1.4;
      if (neuron) {
        const body = (r * 0.85) / (1 + f * 0.7);   // firing shows as brightness and ripples, not a swollen cell
        for (const d of n.dend) {   // dendrites: tapering branches that sway a little
          const sway = Math.sin(t * 0.7 + n.ph + d.a * 3) * 0.12, a = d.a + sway, L = d.L * body * 3.4;
          const sx = n.x + Math.cos(a) * body * 0.8, sy = n.y + Math.sin(a) * body * 0.8;
          const ex = n.x + Math.cos(a + d.bend * 0.3) * (body + L), ey = n.y + Math.sin(a + d.bend * 0.3) * (body + L);
          const cx = n.x + Math.cos(a + d.bend) * (body + L * 0.55), cy = n.y + Math.sin(a + d.bend) * (body + L * 0.55);
          const hx = (cx + ex) / 2, hy = (cy + ey) / 2;
          g.strokeStyle = `rgba(${mix(c, WHITE, f * 0.5)},${0.6 + f * 0.4})`; g.lineCap = "round";
          g.lineWidth = body * 0.4; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, hx, hy); g.stroke();
          g.lineWidth = body * 0.16; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
          g.beginPath(); g.arc(ex, ey, body * 0.12, 0, 7); g.fillStyle = g.strokeStyle; g.fill();   // tip
          for (const kd of d.kids) {
            const q = kd.at, kx = (1 - q) ** 2 * sx + 2 * (1 - q) * q * cx + q * q * hx, ky = (1 - q) ** 2 * sy + 2 * (1 - q) * q * cy + q * q * hy;
            const ka = a + kd.da + sway, kl = kd.L * L;
            g.lineWidth = body * 0.13; g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx + Math.cos(ka) * kl, ky + Math.sin(ka) * kl); g.stroke();
          }
        }
        const pts = 14;   // cell body: a soft, slightly uneven blob with a bright centre
        g.beginPath();
        for (let j = 0; j <= pts; j++) { const a = (j / pts) * Math.PI * 2, rr = body * (1 + 0.13 * Math.sin(a * 3 + n.ph + t * 0.9)); g[j ? "lineTo" : "moveTo"](n.x + Math.cos(a) * rr, n.y + Math.sin(a) * rr); }
        const bg = g.createRadialGradient(n.x - body * 0.2, n.y - body * 0.2, 0, n.x, n.y, body * 1.15);
        bg.addColorStop(0, `rgb(${mix(c, WHITE, 0.8 + f * 0.2)})`); bg.addColorStop(0.5, `rgb(${mix(c, WHITE, 0.2)})`); bg.addColorStop(1, `rgb(${c})`);
        g.fillStyle = bg; g.fill();
      }
      else if (style === "ring") { g.beginPath(); g.arc(n.x, n.y, r * 0.7, 0, 7); g.stroke(); }
      else if (style === "star") {
        const k = r * (0.7 + 0.25 * Math.sin(t * 3 + n.ph));
        g.beginPath(); for (let j = 0; j < 8; j++) { const a = (j * Math.PI) / 4, rr = j % 2 ? k * 0.28 : k; g.lineTo(n.x + Math.cos(a) * rr, n.y + Math.sin(a) * rr); } g.closePath(); g.fill();
      } else if (style === "dot") { g.beginPath(); g.arc(n.x, n.y, r * 0.45, 0, 7); g.fill(); }
      else { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(n.x, n.y, r * 0.35, 0, 7); g.fill(); }
      this.flash[i] = f * 0.9;
    });
    if (nerve) {   // a ring spreading out from each cell that fires
      for (const rp of this.ripples) {
        const n = this.nodes[rp.i]; if (!n) continue;
        rp.t += 0.02; const c = colourOf(n.mood);
        g.strokeStyle = `rgba(${mix(c, WHITE, 0.3)},${0.6 * (1 - rp.t)})`; g.lineWidth = 2.5 * u * (1 - rp.t) + 0.5;
        g.beginPath(); g.arc(n.x, n.y, (20 + rp.t * 110) * u * 1.5, 0, 7); g.stroke();
      }
      this.ripples = this.ripples.filter((rp) => rp.t < 1);
    }
    g.globalCompositeOperation = "source-over";
    if (th.labels !== "hide") {
      g.font = `${20 * u}px ${v("--body-font") || "serif"}`; g.textAlign = "center"; g.fillStyle = v("--text") || "#fff";
      for (const n of this.nodes) g.fillText(n.w, n.x, n.y - (neuron ? 58 : 36) * u);
    }
    if (this.caption) {   // drawn into the canvas so recorded videos carry it (videos get the page background too)
      const c = this.caption, x = 40 * u, y = H - 46 * u, scale = +(v("--title-scale") || 1);
      g.globalCompositeOperation = "destination-over"; g.fillStyle = v("--bg") || "#000"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
      g.textAlign = "left"; g.fillStyle = v("--text"); g.font = `${56 * u * scale}px ${v("--title-font")}`; g.fillText(c.title, x, y - 70 * u);
      g.font = `${28 * u * scale}px ${v("--hand-font")}`; g.fillStyle = v("--accent"); g.fillText(c.mood, x, y - 28 * u);
      g.font = `${18 * u}px ${v("--body-font")}`; g.fillStyle = v("--muted"); g.fillText(c.note, x, y);
      g.textAlign = "right"; g.font = `${32 * u * scale}px ${v("--title-font")}`; g.fillStyle = v("--accent"); g.fillText("The Quantum Diary", W - 40 * u, y);
    }
    requestAnimationFrame((tt) => this.frame(tt));
  }
}
