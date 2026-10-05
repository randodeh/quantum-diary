// "Quantum blur" animation: screens and text appear through real blur-core-v1 output (reveal.json, made by
// tools/make_reveal.py). Seed points from IBM hardware randomness were quantum-blurred at rising strengths;
// each frame is used as a mask, so the page shows through wherever the blur has spread.
let data = null;
const ready = fetch("reveal.json").then((r) => r.json()).then((d) => { data = d; }).catch(() => {});

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const running = new WeakMap();

function maskAt(t) {   // t 0..1 → a mask image for that moment of the blur
  const n = data.frames.length, size = data.size, pos = t * (n - 1), i = Math.min(n - 2, Math.floor(pos)), mix = pos - i;
  const a = data.frames[i].grid, b = data.frames[i + 1].grid;
  const gain = (1 + pos * pos * 0.6) * 0.8 + Math.max(0, t - 0.8) * 40;   // spreads, then fills in fully at the end
  canvas.width = canvas.height = size;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = (a[y][x] * (1 - mix) + b[y][x] * mix) / 255;
    img.data[(y * size + x) * 4 + 3] = Math.min(255, 255 * Math.pow(v, 0.3) * gain);
  }
  ctx.putImageData(img, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

function setMask(el, m) {
  for (const p of ["maskImage", "webkitMaskImage"]) el.style[p] = m;
  for (const p of ["maskSize", "webkitMaskSize"]) el.style[p] = m ? "100% 100%" : "";
}

export async function reveal(el, ms = 900) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!data) { setMask(el, "linear-gradient(transparent,transparent)"); await ready; }
  if (!data) { setMask(el, ""); return; }
  const id = {}; running.set(el, id);
  const start = performance.now();
  const step = () => {
    if (running.get(el) !== id) return;   // a newer reveal took over
    const t = Math.max(0, Math.min(1, (performance.now() - start) / ms));
    setMask(el, t < 1 ? maskAt(t) : "");
    if (t < 1) requestAnimationFrame(step);
  };
  setMask(el, maskAt(0));
  requestAnimationFrame(step);
}

export const quantumMotion = () => (window.QD_THEME || {}).transition === "quantum";
