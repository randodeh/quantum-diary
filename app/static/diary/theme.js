// Every visual choice for The Quantum Diary lives here. The Design Studio (/diary/studio.html) edits these;
// the diary applies exactly what was chosen and nothing else.

// The mandarin fish's colours (from the user's photo, made vivid like the real fish).
export const FISH_SWATCHES = {
  night:     { label: "Night purple",   hex: "#1b1630" },
  ocean:     { label: "Ocean black",    hex: "#0c1413" },
  deepsea:   { label: "Deep sea green", hex: "#0f3b33" },
  orange:    { label: "Fish orange",    hex: "#f2781e" },
  amber:     { label: "Amber",          hex: "#f5a524" },
  electric:  { label: "Electric blue",  hex: "#1d5cf0" },
  royal:     { label: "Royal blue",     hex: "#1b2fa8" },
  teal:      { label: "Teal",           hex: "#14b3a1" },
  turquoise: { label: "Turquoise",      hex: "#22c9d6" },
  green:     { label: "Leaf green",     hex: "#2fa65a" },
  purple:    { label: "Eye purple",     hex: "#7a4cc8" },
  pearl:     { label: "Pearl white",    hex: "#f4f1e8" },
};
// One choice per part of the diary, used when the palette is "Mandarin fish · my colours"
const ROLES = {
  cBg: "Fish colours: background", cPanel: "Fish colours: panels & cards", cTitle: "Fish colours: titles",
  cButton: "Fish colours: buttons & highlights", cText: "Fish colours: text", cMood: "Fish colours: small accents",
};
function fishRoles() {
  const out = {};
  for (const [key, label] of Object.entries(ROLES)) {
    out[key] = { label, swatch: true, options: Object.fromEntries(Object.entries(FISH_SWATCHES).map(([k, s]) => [k, { label: s.label, hex: s.hex }])) };
  }
  return out;
}
const readableOn = (hex) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#0c1413" : "#f4f1e8"; };

export const OPTIONS = {
  palette: { label: "Colour palette", options: {
    fishMine:   { label: "Mandarin fish · my colours (pick below)" },
    lavender: { label: "Lavender night", bg: "#1b1630", bg2: "#2c2350", surface: "#2a2244", text: "#efe9ff", muted: "#b9aed6", accent: "#c7a8ff", accentText: "#1b1630" },
    dusk:     { label: "Pink dusk",      bg: "#2a1724", bg2: "#5a2d4a", surface: "#3a2234", text: "#ffeef5", muted: "#e0b6c8", accent: "#f2a6c6", accentText: "#2a1724" },
    moon:     { label: "Moonlight blue", bg: "#0f1a2e", bg2: "#22385e", surface: "#1a2a45", text: "#e8f1ff", muted: "#a9bddb", accent: "#9cc8ff", accentText: "#0f1a2e" },
    peach:    { label: "Peach aurora",   bg: "#2b1c1e", bg2: "#6a3b3f", surface: "#3b2729", text: "#fff1ea", muted: "#e6c2b4", accent: "#ffb995", accentText: "#2b1c1e" },
    mint:     { label: "Mint dream",     bg: "#11231f", bg2: "#1f4a40", surface: "#1a332d", text: "#eafff8", muted: "#a8d6c8", accent: "#9ff0d4", accentText: "#11231f" },
    cloud:    { label: "Cloud (light)",  bg: "#f3eefb", bg2: "#e6dcf7", surface: "#ffffff", text: "#2a2240", muted: "#7a6e94", accent: "#9b7fd9", accentText: "#ffffff" },
    // From the user's mandarin fish photo (measured): ocean #151d1d / #144639, orange #be682f, teal #169083, blue #11469f.
    // Accents are brightened a little from the photo so text on the dark background stays readable.
    fishOrange: { label: "Mandarin fish · orange", bg: "#111a1a", bg2: "#144639", surface: "#17302d", text: "#f3ece0", muted: "#9db7ae", accent: "#e57b34", accentText: "#111a1a" },
    fishTeal:   { label: "Mandarin fish · teal",   bg: "#111a1a", bg2: "#144639", surface: "#17302d", text: "#f3ece0", muted: "#9db7ae", accent: "#22b3a2", accentText: "#111a1a" },
    fishBlue:   { label: "Mandarin fish · blue",   bg: "#111a1a", bg2: "#11469f", surface: "#172a3a", text: "#f3ece0", muted: "#a4b7cf", accent: "#3b78e6", accentText: "#ffffff" },
  } },
  ...fishRoles(),
  moodColours: { label: "Feeling colours (brain map + week)", options: {
    original: { label: "Original" }, fish: { label: "Mandarin fish" },
  } },
  background: { label: "Background", options: {
    plain: { label: "Plain colour" }, gradient: { label: "Soft gradient" }, stars: { label: "Night sky with stars" }, aurora: { label: "Moving aurora" },
  } },
  titleFont: { label: "Title font", font: true, options: {
    "Cormorant Garamond": { label: "Cormorant" }, "Playfair Display": { label: "Playfair" }, "Fraunces": { label: "Fraunces" },
    "Bebas Neue": { label: "Bebas Neue" }, "Quicksand": { label: "Quicksand" }, "Comfortaa": { label: "Comfortaa" }, "Italiana": { label: "Italiana" },
  } },
  bodyFont: { label: "Text font", font: true, options: {
    "Libre Baskerville": { label: "Baskerville" }, "EB Garamond": { label: "Garamond" }, "Lora": { label: "Lora" }, "Nunito": { label: "Nunito" }, "Inter": { label: "Inter" },
  } },
  handFont: { label: "Handwriting font", font: true, options: {
    "Permanent Marker": { label: "Permanent Marker" }, "Caveat": { label: "Caveat" }, "Dancing Script": { label: "Dancing Script" }, "Homemade Apple": { label: "Homemade Apple" }, "none": { label: "No handwriting" },
  } },
  titleSize: { label: "Title size", options: { "0.8": { label: "Small" }, "1": { label: "Medium" }, "1.25": { label: "Large" }, "1.5": { label: "Huge" } } },
  textSize: { label: "Text size", options: { "15": { label: "Small" }, "17": { label: "Medium" }, "19": { label: "Large" } } },
  corners: { label: "Corners", options: { "0": { label: "Sharp" }, "10": { label: "Soft" }, "22": { label: "Round" } } },
  spacing: { label: "Spacing", options: { "0.8": { label: "Compact" }, "1": { label: "Comfortable" }, "1.3": { label: "Airy" } } },
  writePaper: { label: "Writing page", options: { glass: { label: "Floating panel" }, lined: { label: "Lined paper" }, grid: { label: "Grid paper" }, blank: { label: "Blank paper" }, none: { label: "No page, text on background" } } },
  buttons: { label: "Buttons", options: { pill: { label: "Filled pill" }, outline: { label: "Outline" }, text: { label: "Text only" }, square: { label: "Filled square" } } },
  navIcons: { label: "Menu", options: { text: { label: "Words only" }, icons: { label: "Words + emojis" } } },
  transition: { label: "Moving between screens", options: { none: { label: "Instant" }, fade: { label: "Fade" }, rise: { label: "Fade up" }, blur: { label: "Blur in" }, quantum: { label: "Quantum blur (blur-core-v1)" } } },
  nodeStyle: { label: "Brain map points", options: { glow: { label: "Glowing orbs" }, star: { label: "Twinkling stars" }, ring: { label: "Rings" }, dot: { label: "Simple dots" }, neuron: { label: "Neurons" } } },
  glow: { label: "Glow", options: { "0": { label: "None" }, "0.5": { label: "Subtle" }, "1": { label: "Strong" } } },
  motion: { label: "Animation speed", options: { "0": { label: "Still" }, "0.5": { label: "Slow" }, "1": { label: "Normal" } } },
  mapBackdrop: { label: "Behind the brain map", options: { none: { label: "Page colour" }, deepsea: { label: "Deep sea glow" }, ocean: { label: "Ocean black glow" }, royal: { label: "Royal blue glow" } } },
  connections: { label: "Brain map connections", options: { nerve: { label: "Wavy fibres with signals" }, classic: { label: "Simple curves" } } },
  labels: { label: "Words on the brain map", options: { show: { label: "Show" }, hide: { label: "Hide" } } },
  happySound: { label: "Happy songs sound like", options: { dreamy: { label: "Dreamy bells" }, warm: { label: "Warm piano" }, lofi: { label: "Lo-fi" } } },
  music: { label: "Background music", options: { on: { label: "Soft quantum music (qrc-midi-v1)" }, off: { label: "Off" } } },
};

// What the diary looks like before anyone chooses: plain and quiet. Decoration only appears when chosen.
export const DEFAULT_THEME = {
  palette: "lavender", background: "plain", titleFont: "Cormorant Garamond", bodyFont: "Lora", handFont: "none",
  titleSize: "1", textSize: "17", corners: "10", spacing: "1", writePaper: "glass", buttons: "pill", navIcons: "text",
  transition: "none", nodeStyle: "glow", glow: "0.5", motion: "0.5", labels: "show", connections: "classic", mapBackdrop: "none", music: "off", happySound: "dreamy", moodColours: "original",
  cBg: "deepsea", cPanel: "royal", cTitle: "orange", cButton: "orange", cText: "pearl", cMood: "turquoise",
};

const KEY = "quantum-diary-theme-v3";   // v3: start fresh from the fish colours (one per part of the diary)
export function loadTheme() {
  try { return { ...DEFAULT_THEME, ...(window.CHOSEN_THEME || {}), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULT_THEME, ...(window.CHOSEN_THEME || {}) }; }
}
export function saveTheme(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch {} }

export function applyTheme(t) {
  const r = document.documentElement, s = r.style;
  let p = OPTIONS.palette.options[t.palette];
  if (t.palette === "fishMine" || !p || !p.bg) {   // build the palette from the fish colour chosen for each part
    const c = (k, d) => (FISH_SWATCHES[t[k]] || FISH_SWATCHES[d]).hex;
    const bg = c("cBg", "deepsea"), text = c("cText", "pearl");
    p = { bg, bg2: c("cPanel", "royal"), surface: c("cPanel", "royal"), text, muted: text, accent: c("cButton", "orange"),
          accentText: readableOn(c("cButton", "orange")), title: c("cTitle", "orange"), small: c("cMood", "turquoise") };
  }
  s.setProperty("--bg", p.bg); s.setProperty("--bg2", p.bg2); s.setProperty("--surface", p.surface); s.setProperty("--text", p.text);
  s.setProperty("--muted", p.muted); s.setProperty("--accent", p.accent); s.setProperty("--accent-text", p.accentText);
  s.setProperty("--title-colour", p.title || p.text); s.setProperty("--small-accent", p.small || p.accent);
  s.setProperty("--title-font", `"${t.titleFont}"`); s.setProperty("--body-font", `"${t.bodyFont}"`);
  s.setProperty("--hand-font", t.handFont === "none" ? `"${t.bodyFont}"` : `"${t.handFont}"`);
  s.setProperty("--title-scale", t.titleSize); s.setProperty("--text-size", t.textSize + "px");
  s.setProperty("--radius", t.corners + "px"); s.setProperty("--space", t.spacing);
  r.dataset.bg = t.background; r.dataset.paper = t.writePaper; r.dataset.buttons = t.buttons; r.dataset.nav = t.navIcons;
  r.dataset.transition = t.transition; r.dataset.hand = t.handFont === "none" ? "off" : "on";
  r.dataset.light = t.palette === "cloud" ? "yes" : "no";
  window.QD_THEME = t;   // the brain map reads nodeStyle / glow / motion / labels from here every frame
}
