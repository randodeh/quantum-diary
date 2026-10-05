// Reading an entry, entirely in the browser (the text is never sent anywhere):
//  - how you typed: speed, force, pauses, rhythm (from the key presses)
//  - what it's about: feelings from word lists (transparent, editable; no AI)
//  - the "moments": key words that become the glowing points of the brain map, and how they link

// ---------- feelings: edit these lists freely ----------
export const MOODS = {
  happy:   { colour: [255, 200, 110], words: ["happy", "fun", "laugh", "laughed", "laughing", "smile", "smiled", "great", "amazing", "best", "good", "yay", "lol", "haha", "enjoyed", "celebrate", "party", "summer", "sunny", "win", "won", "proud", "glad", "joy"] },
  love:    { colour: [242, 120, 170], words: ["love", "loved", "hug", "hugged", "friend", "friends", "mum", "mom", "dad", "family", "together", "missed", "kiss", "cute", "crush", "sister", "brother", "grandma", "grandad", "cat", "dog"] },
  calm:    { colour: [120, 220, 200], words: ["calm", "quiet", "peace", "peaceful", "relaxed", "rest", "slept", "okay", "fine", "chill", "tea", "walk", "rain", "slow", "breathe", "cosy", "cozy", "home", "sleep"] },
  hopeful: { colour: [255, 170, 200], words: ["hope", "hopeful", "maybe", "tomorrow", "future", "brave", "try", "trying", "better", "believe", "dream", "plan", "wish", "start", "new", "goal"] },
  excited: { colour: [255, 140, 80],  words: ["excited", "cant wait", "can't wait", "omg", "finally", "wow", "trip", "concert", "holiday", "birthday", "surprise", "yes"] },
  anxious: { colour: [150, 120, 255], words: ["anxious", "worried", "worry", "nervous", "scared", "stress", "stressed", "exam", "exams", "test", "deadline", "behind", "panic", "overthinking", "late", "cant sleep", "couldn't sleep", "pressure"] },
  sad:     { colour: [90, 140, 230],  words: ["sad", "cry", "cried", "crying", "tears", "alone", "lonely", "tired", "exhausted", "drained", "lost", "hurt", "down", "empty", "numb", "bored", "sorry", "hate myself", "failed", "grey", "bad", "awful", "terrible", "horrible", "worst", "upset", "unhappy", "miserable", "depressed", "heartbroken", "hopeless", "pointless", "disappointed", "let down", "left out", "ignored", "nobody", "no one", "rubbish", "gloomy"] },
  angry:   { colour: [240, 80, 80],   words: ["angry", "mad", "annoyed", "annoying", "hate", "furious", "unfair", "stupid", "ugh", "argh", "fight", "argued", "shouted", "rage", "sick of"] },
};
export const NEUTRAL = { colour: [200, 190, 230] };

// Feeling colours taken from the user's mandarin fish photo (brightened slightly for the dark background)
const FISH = {   // the fish swatches in theme.js: amber, orange, purple eye, leaf green, teal, electric blue, royal blue, deep orange, turquoise
  happy: [245, 165, 36], excited: [242, 120, 30], love: [122, 76, 200], hopeful: [47, 166, 90],
  calm: [20, 179, 161], anxious: [29, 92, 240], sad: [27, 47, 168], angry: [214, 80, 20], none: [34, 201, 214],
};
export function moodColour(mood) {
  if ((window.QD_THEME || {}).moodColours === "fish") return FISH[mood] || FISH.none;
  return (MOODS[mood] || NEUTRAL).colour;
}

const STOP = new Set("the a an and or but so to of in on at for with my me i im i'm it its it's is was were be been am are this that then than just really very like got get go went do did not no yes you your we our they them he she his her have has had will would can could about from up out into over after before when what who why how all some more too also there here today well feel feels felt feeling know knew think thought because even still much many being thing things something anything nothing everything kind sort actually literally basically honestly though although dont didnt cant couldnt wont wouldnt isnt wasnt been going gonna want wanna wanted need needed said says tell told make made getting kinda pretty quite maybe probably guess mean mostly always never every again other another these those where which while only into onto lots little don't didn't can't couldn't won't wouldn't isn't wasn't i've that's there's what's".split(" "));

// ---------- typing ----------
export class TypingRecorder {
  constructor(textarea) {
    this.events = [];
    textarea.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const kind = e.key === "Backspace" || e.key === "Delete" ? "erase" : e.key === "Enter" ? "enter" : e.key.length === 1 ? "char" : null;
      if (kind) this.events.push({ t: performance.now(), key: kind === "char" ? e.key : "", kind, shift: e.shiftKey });
    });
    // pasted text has no key presses: remember how much came in that way, so we never pretend to read typing that didn't happen
    textarea.addEventListener("paste", (e) => {
      const n = (e.clipboardData?.getData("text") || "").length;
      if (n) this.events.push({ t: performance.now(), key: "", kind: "paste", n });
    });
  }
  reset() { this.events = []; }
}

export function typingStats(events) {
  const pasted = events.filter((e) => e.kind === "paste").reduce((s, e) => s + e.n, 0);
  events = events.filter((e) => e.kind !== "paste");
  const chars = events.filter((e) => e.kind === "char"), erases = events.filter((e) => e.kind === "erase").length;
  const gaps = []; let pauses = 0, active = 0;
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].t - events[i - 1].t;
    if (gap > 1500) pauses++;
    else { gaps.push(gap); active += gap; }
  }
  const mean = gaps.reduce((s, g) => s + g, 0) / (gaps.length || 1);
  const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / (gaps.length || 1));
  const wpm = active ? (chars.length / 5) / (active / 60000) : 0;
  const caps = chars.filter((e) => /[A-Z]/.test(e.key)).length / (chars.length || 1);
  const bangs = chars.filter((e) => e.key === "!").length;
  const bursts = gaps.filter((g) => g < 90).length / (gaps.length || 1);
  const eraseRate = erases / (events.length || 1);
  // force 0..1: fast, bursty, lots of caps / !!! / hammering backspace
  const force = Math.max(0, Math.min(1, 0.35 * Math.min(1, wpm / 90) + 0.25 * bursts + 0.15 * Math.min(1, caps * 4) + 0.1 * Math.min(1, bangs / 4) + 0.15 * Math.min(1, eraseRate * 6)));
  return { keys: events.length, chars: chars.length, pasted, erases, pauses, wpm: Math.round(wpm), meanGap: Math.round(mean), rhythmSpread: Math.round(sd), force: +force.toFixed(2) };
}

// What your typing suggests (signals, not mind-reading): energy from speed and force, tension from
// deleting and stopping, calm from an even rhythm.
export const FINGER_MOODS = {
  "wound up":  { colour: [240, 110, 90],  mood: "angry" },
  energetic:   { colour: [255, 170, 80],  mood: "excited" },
  tense:       { colour: [150, 120, 255], mood: "anxious" },
  low:         { colour: [90, 140, 230],  mood: "sad" },
  calm:        { colour: [120, 220, 200], mood: "calm" },
  steady:      { colour: [200, 190, 230], mood: null },
};
export function typingMood(s) {
  if (s.pasted > s.chars) return { label: "pasted", why: "it was pasted in, so there was no typing to read" };
  const per100 = (n) => (s.chars ? (n / s.chars) * 100 : 0);
  const erasing = per100(s.erases), stopping = per100(s.pauses);
  if (s.wpm >= 55 && s.force >= 0.4) return erasing > 8 ? { label: "wound up", why: `fast, hard typing with lots of deleting (${s.erases} deletions)` } : { label: "energetic", why: `fast, forceful typing (${s.wpm} wpm)` };
  if (erasing > 8 || stopping > 3) return { label: "tense", why: `${s.erases} deletions and ${s.pauses} long pauses` };
  if (s.wpm < 28) return { label: "low", why: `slow typing (${s.wpm} wpm)` };
  if (s.rhythmSpread < s.meanGap * 0.6) return { label: "calm", why: "an even, unhurried rhythm" };
  return { label: "steady", why: "a normal pace with few stops" };
}

// ---------- feelings ----------
// "not happy" / "don't feel good" count as sad; "not sad" counts as nothing
const NEGATE = new Set("not no never dont don't didnt didn't isnt isn't wasnt wasn't arent aren't cant can't couldnt couldn't wont won't hardly barely without".split(" "));
const POSITIVE = new Set(["happy", "love", "calm", "hopeful", "excited"]);
function hits(text) {
  const lower = " " + text.toLowerCase().replace(/[’]/g, "'") + " ";
  const found = [];
  for (const [mood, m] of Object.entries(MOODS)) for (const w of m.words) {
    const re = new RegExp(`[^a-z']${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z']`, "g");
    let r; while ((r = re.exec(lower))) {
      const before = lower.slice(Math.max(0, r.index - 30), r.index + 1).split(/[^a-z']+/).filter(Boolean).slice(-3);
      const negated = !w.includes(" ") && before.some((b) => NEGATE.has(b));
      if (!negated) found.push({ mood, word: w, at: r.index });
      else if (POSITIVE.has(mood)) found.push({ mood: "sad", word: `not ${w}`, at: r.index });
    }
  }
  return found;
}

export function feelings(text) {
  const counts = {}, lastAt = {};
  for (const h of hits(text)) { counts[h.mood] = (counts[h.mood] || 0) + 1; lastAt[h.mood] = Math.max(lastAt[h.mood] ?? -1, h.at); }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || lastAt[b[0]] - lastAt[a[0]]).map(([m]) => m);   // ties: the feeling you ended on
  // how the entry moved: the feeling near the start vs near the end
  const half = Math.floor(text.length / 2), hs = hits(text);
  const first = hs.filter((h) => h.at < half), last = hs.filter((h) => h.at >= half);
  const top = (arr) => { const c = {}; for (const h of arr) c[h.mood] = (c[h.mood] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };
  return { ranked, counts, from: top(first), to: top(last) };
}

// ---------- moments + links (the brain map) ----------
// What a sentence is about: people and places first, then things, then what you did, then how things were.
// Uses compromise (vendor/compromise.js, MIT), a small grammar library that runs in the browser, so the text
// still never leaves the device. Stretched words ("sooooo") and filler are skipped.
const SKIP_TAGS = ["Pronoun", "Possessive", "Determiner", "Conjunction", "Preposition", "Auxiliary", "Copula", "Modal", "Adverb", "QuestionWord", "Date", "Value", "Expression", "Negative"];
const SCORE = [["ProperNoun", 5], ["Noun", 4], ["Verb", 3], ["Adjective", 2]];
const stretched = (w) => /(.)\1\1/.test(w);
function subjects(sentence) {
  const nlp = globalThis.nlp;
  const plain = () => sentence.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).map((w) => ({ w, score: w.length >= 4 ? 1 : 0 }));
  const terms = nlp ? nlp(sentence).terms().json().map((t) => {
    const term = t.terms[0], tags = term.tags || [];
    const score = tags.some((g) => SKIP_TAGS.includes(g)) ? 0 : (SCORE.find(([g]) => tags.includes(g)) || [0, 0])[1];
    return { w: tags.includes("ProperNoun") ? term.text.replace(/[^A-Za-z'-]/g, "") : term.normal.replace(/[^a-z'-]/g, ""), score };
  }) : plain();
  return terms.filter((t) => t.score > 0 && t.w.length >= 3 && !STOP.has(t.w.toLowerCase()) && !stretched(t.w.toLowerCase()))
    .sort((a, b) => b.score - a.score || b.w.length - a.w.length).map((t) => t.w);
}

export function moments(text) {
  const sentences = text.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean);
  const out = [], seen = new Set();
  const take = (w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; };
  sentences.forEach((s, si) => {
    const sh = hits(s).sort((a, b) => b.word.length - a.word.length);
    const picks = [];
    for (const h of sh) if (picks.length < 2 && take(h.word)) picks.push({ w: h.word, mood: h.mood });
    // what the sentence is about: always when there's no feeling word, and alongside one in a longer sentence
    if (picks.length === 0 || (picks.length === 1 && s.split(/\s+/).length >= 8)) {
      const w = subjects(s).find((x) => !seen.has(x.toLowerCase()));
      if (w) { take(w); picks.push({ w, mood: null }); }
    }
    for (const p of picks) out.push({ ...p, sentence: si });
  });
  // too many: keep an even spread; too few: pad with what the whole entry is about
  let list = out;
  if (list.length > 14) list = Array.from({ length: 14 }, (_, i) => out[Math.floor((i * out.length) / 14)]);
  if (list.length < 3) {
    const extra = subjects(text).filter((w) => take(w)).slice(0, 3 - list.length);
    list = [...list, ...extra.map((w) => ({ w, mood: null, sentence: 0 }))];
  }
  // moments without a feeling word borrow the feeling of their sentence's neighbours
  list.forEach((m, i) => { if (!m.mood) m.mood = list.slice(i + 1).concat(list.slice(0, i).reverse()).find((x) => x.mood)?.mood || null; });
  return list;
}

export function linksFor(ms) {
  const set = new Set(), links = [];
  const add = (a, b) => { if (a === b) return; const k = a < b ? `${a},${b}` : `${b},${a}`; if (!set.has(k) && links.length < 44) { set.add(k); links.push(a < b ? [a, b] : [b, a]); } };
  for (let i = 1; i < ms.length; i++) add(i - 1, i);                                       // the entry's flow
  ms.forEach((m, i) => ms.forEach((n, j) => { if (j > i && m.sentence === n.sentence) add(i, j); }));   // same thought
  ms.forEach((m, i) => { const j = ms.findIndex((n, k) => k > i + 1 && n.mood && n.mood === m.mood); if (j > 0) add(i, j); });   // same feeling
  for (let i = 0; i + 2 < ms.length && links.length < ms.length * 1.6; i++) add(i, i + 2);          // thoughts that echo a little later
  return links;
}

// A number from the typing rhythm, so every entry's quantum runs are seeded by how you typed
export function rhythmSeed(events) {
  let h = 2166136261;
  for (let i = 1; i < events.length; i++) { h ^= Math.round(events[i].t - events[i - 1].t); h = Math.imul(h, 16777619) >>> 0; }
  return h % 2147483647;
}
