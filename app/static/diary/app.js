// The Quantum Diary: write → measure (in the browser + two Moth engines) → living brain map + song, saved by date.
import { TypingRecorder, typingStats, feelings, moments, linksFor, rhythmSeed, MOODS, typingMood } from "./analyse.js";
import { typingMelody, Player, moodTempo } from "./music.js";
import { BrainMap } from "./brainmap.js";
import { setupWeek } from "./week.js";
import { loadTheme, applyTheme } from "./theme.js";
import { reveal, quantumMotion } from "./reveal.js";
import { Ambient } from "./ambient.js";

applyTheme({ ...loadTheme(), ...Object.fromEntries((new URLSearchParams(location.search).get("try") || "").split(",").filter(Boolean).map((kv) => kv.split(":"))) });

const $ = (s) => document.querySelector(s);
const STORE = "quantum-diary-v1";
const player = new Player();
let entries = load(), current = entries.length - 1, map = null, flip = null;
entries.forEach((e) => { if (e.text) e.feelings = feelings(e.text); });   // saved entries get the latest feeling rules (negation etc.)

// ---------- storage (this device only) ----------
function load() { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(entries)); } catch { /* storage full or blocked: keep in memory */ } }

// ---------- views ----------
function show(view) {
  player.stop(); $("#play").textContent = "Play this day";
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + view));
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
  $("#nav").hidden = view === "cover";
  if (view === "quantum") showQuantum();
  if (view === "normal") buildBook();
  if (view === "week") weekReview.render();
  if (view === "write") setTimeout(() => $("#text").focus(), 50);
  if (quantumMotion()) reveal($("#v-" + view));   // the screen appears through the quantum blur
}
document.addEventListener("click", (e) => { const v = e.target.closest("[data-view]"); if (v) show(v.dataset.view); });
$("#open").onclick = () => {
  try { show(entries.length ? "quantum" : "write"); }
  catch (err) { showProblem(err.message); show("write"); }   // never leave someone stuck on the cover
};

// ---------- writing ----------
const niceDate = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
$("#today").textContent = niceDate(Date.now());
const text = $("#text"), recorder = new TypingRecorder(text);
text.addEventListener("input", () => {
  const words = text.value.trim().split(/\s+/).filter(Boolean).length, s = typingStats(recorder.events);
  $("#finish").disabled = words < 12;
  $("#live").textContent = words < 12 ? `${words} words · write at least 12`
    : s.pasted > s.chars ? `${words} words · pasted in: your words will be read, but there's no typing to read`
    : `${words} words · ${s.wpm} wpm · typing force ${Math.round(s.force * 100)}%`;
});
$("#finish").onclick = () => makeEntry(text.value.trim(), recorder.events.slice());

// ---------- making an entry ----------
async function job(url, body, result) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "busy");
  const { job_id } = await r.json();
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const s = await (await fetch(`/api/jobs/${encodeURIComponent(job_id)}`)).json();
    if (s.status === "completed") break;
    if (s.status === "failed" || s.status === "cancelled") throw new Error("the engine couldn't finish");
    await new Promise((res) => setTimeout(res, 1500));
  }
  const out = await (await fetch(`/api/jobs/${encodeURIComponent(job_id)}/${result}`)).json();
  return { out, job_id };
}

function steps(list) {
  $("#steps").innerHTML = list.map((s, i) => `<li id="step${i}"><b>${s[0]}</b>${s[1]}</li>`).join("");
  return (i, state) => { const li = $("#step" + i); li.className = state; if (state === "now" && quantumMotion()) reveal(li, 700); };
}

async function makeEntry(body, events) {
  show("making");
  const mark = steps([
    ["Reading your words", "Feelings and key moments, found in your browser from word lists. Your text stays here."],
    ["Reading how you typed", "Speed, force, pauses and rhythm from your key presses."],
    ["Connecting your thoughts", "Your moments become a network of qubits. Moth's <code>graph-v1</code> Quantum Graph engine measures how strongly each pair is connected."],
    ["Composing your song", "Your typing becomes a melody. Moth's <code>qrc-midi-v1</code> quantum reservoir learns it and writes the day's song in your rhythm."],
  ]);
  mark(0, "now");
  const feel = feelings(body), ms = moments(body), links = linksFor(ms);
  await new Promise((r) => setTimeout(r, 500)); mark(0, "done"); mark(1, "now");
  const stats = typingStats(events), seed = rhythmSeed(events), mood = feel.ranked[0] || "none";
  const melody = typingMelody(events, mood, stats, body);
  await new Promise((r) => setTimeout(r, 400)); mark(1, "done"); mark(2, "now"); mark(3, "now");

  const entry = { id: Date.now(), date: Date.now(), text: body, feelings: feel, stats, moments: ms, links, seed };
  const graph = job("/api/diary/graph", { n: ms.length, links, seed }, "values").then(({ out, job_id }) => {
    const v = out.values, rel = v.tomography?.relationships || {}, raw = links.map(([a, b]) => {
      const r = rel[`${a},${b}`] || rel[`${b},${a}`] || {};
      return Math.sqrt(Object.values(r).reduce((s, x) => s + x * x, 0));
    });
    const max = Math.max(...raw) || 1;
    entry.strengths = raw.map((x) => +(0.15 + 0.85 * (x / max)).toFixed(3));
    entry.bloch = ms.map((_, i) => v.tomography?.bloch?.[i] || { X: 0, Y: 0, Z: 0 });
    entry.graph = { engine: "graph-v1", job_id, backend: v.backend, mode: v.mode };
    mark(2, "done");
  }).catch(() => { entry.strengths = links.map(() => 0.5); entry.graph = { engine: "none", note: "quantum engine busy: links shown evenly" }; mark(2, "done"); });
  const song = job("/api/diary/song", { bpm: melody.bpm, notes: melody.notes, velocity: melody.velocity, seed }, "notes").then(({ out, job_id }) => {
    entry.song = { bpm: melody.bpm, notes: out.notes, source: "qrc-midi-v1", job_id };
    mark(3, "done");
  }).catch(() => { entry.song = { bpm: melody.bpm, notes: melody.notes, source: "typing (quantum engine busy)" }; mark(3, "done"); });
  await Promise.all([graph, song]);

  entries.push(entry); save(); current = entries.length - 1;
  text.value = ""; recorder.reset(); $("#finish").disabled = true; $("#live").textContent = "";
  show("quantum");
}

const weekReview = setupWeek({ getEntries: () => entries, player, job });

// ---------- quantum diary ----------
const moodName = (m) => (m && MOODS[m] ? m : "reflective");
function showQuantum(fresh) {
  const e = entries[current];
  $("#qEmpty").hidden = !!e;
  for (const id of ["#map", ".q-head", ".q-controls", "#qProof"]) $(id).style.visibility = e ? "visible" : "hidden";
  if (!e) return;
  if (!map) map = new BrainMap($("#map")); else map.resize();
  map.show(e, player);
  const f = e.feelings;
  $("#qDate").textContent = niceDate(e.date);
  const words = f.from && f.to && f.from !== f.to ? `${moodName(f.from)} → ${moodName(f.to)}` : moodName(f.ranked[0]);
  const fingers = typingMood(e.stats);
  $("#qMood").innerHTML = fingers.label === "pasted" ? `<span class="wf">your words said</span> <b>${words}</b>`
    : `<span class="wf">your words said</span> <b>${words}</b> <span class="wf">· your typing said</span> <b>${fingers.label}</b>`;
  $("#qWhy").textContent = `(typing: ${fingers.why})`;
  const s = e.stats;
  const typed = fingers.label === "pasted" ? ["pasted in"] : [`${s.wpm} wpm`, `typing force ${Math.round(s.force * 100)}%`, `${s.pauses} long pauses`, `${s.erases} deletions`];
  $("#qChips").innerHTML = [...typed, `${e.moments.length} moments`, `${e.links.length} connections`, `${moodTempo(e.song.bpm, f.ranked[0] || "none")} bpm`]
    .map((c) => `<span>${c}</span>`).join("");
  $("#qProof").textContent = [
    e.graph.engine === "graph-v1" ? `Connections measured by Moth's Quantum Graph engine (graph-v1, ${e.graph.backend} simulator) · job ${e.graph.job_id.slice(0, 8)}…` : e.graph.note,
    e.song.source === "qrc-midi-v1" ? `Song by Moth's QRC MIDI quantum reservoir (qrc-midi-v1) · job ${e.song.job_id.slice(0, 8)}…` : e.song.source,
  ].join("  ·  ");
  $("#prev").disabled = current <= 0; $("#next").disabled = current >= entries.length - 1;
  if (fresh && quantumMotion()) { reveal($(".q-head")); reveal($("#map"), 1200); }   // another day's words appear through the blur
}
$("#prev").onclick = () => { if (current > 0) { current--; player.stop(); $("#play").textContent = "Play this day"; showQuantum(true); } };
$("#next").onclick = () => { if (current < entries.length - 1) { current++; player.stop(); $("#play").textContent = "Play this day"; showQuantum(true); } };
$("#play").onclick = () => {
  const e = entries[current]; if (!e) return;
  if (player.playing) { player.stop(); $("#play").textContent = "Play this day"; return; }
  player.play(e.song, e.feelings.ranked[0] || "none", e.stats.force); $("#play").textContent = "Stop";
};

// ---------- saving: the song as a .wav, the brain map + song as a video ----------
const fileStamp = (e) => new Date(e.date).toISOString().slice(0, 10);
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$("#dlSong").onclick = async () => {
  const e = entries[current]; if (!e) return;
  const b = $("#dlSong"); b.disabled = true; b.textContent = "saving…";
  try {
    $("#play").textContent = "Play this day";
    download(await player.renderWav(e.song, e.feelings.ranked[0] || "none", e.stats.force), `quantum-diary-song-${fileStamp(e)}.wav`);
  } finally { b.disabled = false; b.textContent = "Save song"; }
};
let recording = null;   // { rec, tick } while a video is being recorded
$("#recVideo").onclick = () => {
  if (recording) { clearInterval(recording.tick); recording.rec.stop(); return; }   // press again to stop early
  const e = entries[current]; if (!e || !window.MediaRecorder) { showProblem("this browser can't record video"); return; }
  const b = $("#recVideo");
  player.play(e.song, e.feelings.ranked[0] || "none", e.stats.force); $("#play").textContent = "Stop";
  const f = e.feelings, words = f.from && f.to && f.from !== f.to ? `${moodName(f.from)} → ${moodName(f.to)}` : moodName(f.ranked[0]);
  map.caption = { title: niceDate(e.date), mood: words, note: e.song.source === "qrc-midi-v1" ? "song: QRC quantum reservoir (qrc-midi-v1) · connections: Quantum Graph (graph-v1) · Moth Atlas" : "made with Moth Atlas engines" };
  const stream = new MediaStream([...$("#map").captureStream(30).getVideoTracks(), ...player.tap.stream.getAudioTracks()]);
  const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 }), chunks = [];
  rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
  rec.onstop = () => {
    map.caption = null; recording = null; b.textContent = "Record video"; player.stop(); $("#play").textContent = "Play this day";
    download(new Blob(chunks, { type: rec.mimeType || "video/webm" }), `quantum-diary-${fileStamp(e)}.webm`);
  };
  const secs = Math.min(45, Math.max(12, Math.round(player.loop * 2)));
  rec.start();
  let left = secs; b.textContent = `Stop recording (${left}s)`;
  const tick = setInterval(() => { left--; b.textContent = `Stop recording (${left}s)`; if (left <= 0) { clearInterval(tick); rec.stop(); } }, 1000);
  recording = { rec, tick };
};

// ---------- normal diary (flip book) ----------
function esc(s) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function buildBook() {
  if (flip) { try { flip.destroy(); } catch {} flip = null; }
  const host = $("#bookHost"); host.innerHTML = "";
  const book = document.createElement("div"); host.append(book);
  const pages = [`<div class="page cover-page" data-density="hard"><h1>The Quantum Diary</h1><p class="hand">${entries.length} ${entries.length === 1 ? "day" : "days"}</p></div>`];
  entries.forEach((e, i) => {
    const f = e.feelings, mood = f.from && f.to && f.from !== f.to ? `${moodName(f.from)} → ${moodName(f.to)}` : moodName(f.ranked[0]);
    pages.push(`<div class="page" data-density="hard"><div class="page-in"><div class="date">${niceDate(e.date)}</div><div class="hand">${mood}</div>
      <div class="body">${esc(e.text)}</div><div class="actions"><button class="btn see" data-open="${i}">See this day</button> <button class="btn secondary see" data-play="${i}">Play this day</button></div></div><span class="num">${i + 1}</span></div>`);
  });
  if (!entries.length) pages.push(`<div class="page" data-density="hard"><div class="date">No entries yet</div><p class="hand">write your first one</p></div>`);
  if (pages.length % 2) pages.push(`<div class="page" data-density="hard"></div>`);
  pages.push(`<div class="page cover-page" data-density="hard"></div>`);
  book.innerHTML = pages.join("");
  flip = new St.PageFlip(book, { width: 420, height: 580, size: "stretch", minWidth: 260, maxWidth: 480, minHeight: 360, maxHeight: 660,
    showCover: true, flippingTime: 900, maxShadowOpacity: 0.5, mobileScrollSupport: false, usePortrait: true });
  flip.loadFromHTML(book.querySelectorAll(".page"));
  const resetPlay = () => book.querySelectorAll("[data-play]").forEach((x) => { x.textContent = "Play this day"; });
  book.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-open]"); if (b) { current = +b.dataset.open; show("quantum"); return; }
    const p = ev.target.closest("[data-play]"); if (!p) return;
    ev.stopPropagation();
    const was = p.textContent === "Stop";
    player.stop(); resetPlay();
    if (was) return;
    const e = entries[+p.dataset.play];
    player.play(e.song, e.feelings.ranked[0] || "none", e.stats.force); p.textContent = "Stop";
  });
  flip.on("flip", () => { if (player.playing) { player.stop(); resetPlay(); } });   // turning the page stops that day's song
}

// test hooks for screenshots: ?demo fills two example entries (without calling the engines); ?view=…
const q = new URLSearchParams(location.search);

// ---------- calm background music (written by qrc-midi-v1, see ambient.js) ----------
const ambient = new Ambient(player), MUSIC = "quantum-diary-music";
const wantMusic = () => { try { const m = localStorage.getItem(MUSIC); if (m) return m === "on"; } catch {} return (window.QD_THEME || {}).music === "on"; };
const musicLabel = () => { $("#music").textContent = ambient.on ? "Music on" : "Music off"; };
$("#music").onclick = async () => { await ambient.toggle(); try { localStorage.setItem(MUSIC, ambient.on ? "on" : "off"); } catch {} musicLabel(); };
const firstTouch = () => { if (wantMusic() && !q.has("studio")) ambient.start().then(musicLabel); };   // browsers only allow sound after a click or key
document.addEventListener("pointerdown", firstTouch, { once: true });
document.addEventListener("keydown", firstTouch, { once: true });
musicLabel();
if (q.has("demo") && !entries.length) {
  const mk = (body, daysAgo, speed) => {
    const ev = []; let t = 0; for (const ch of body) { t += speed + (ch === " " ? 60 : 0) + (ch === "." ? 700 : 0); ev.push({ t, key: ch, kind: "char", shift: /[A-Z]/.test(ch) }); }
    const feel = feelings(body), ms = moments(body), links = linksFor(ms), stats = typingStats(ev);
    return { id: daysAgo, date: Date.now() - daysAgo * 864e5, text: body, feelings: feel, stats, moments: ms, links, strengths: links.map((_, i) => 0.2 + ((i * 37) % 80) / 100),
      song: { ...typingMelody(ev, feel.ranked[0] || "none", stats), source: "demo (no engine call)" }, graph: { engine: "none", note: "demo entry (no engine call)" } };
  };
  entries = [
    mk("Couldn't sleep again. The mock exam is on Friday and I feel so behind. But then Maya called and we laughed about the stupid bus for an hour, and it felt like summer. Mum made pancakes. Maybe it's going to be okay. I want to be brave this week.", 1, 150),
    mk("Ugh. Today was SO annoying. The group project fell apart and nobody listened. I'm sick of doing everything myself! Walked home in the rain and felt better. Tea and my cat. Tomorrow is a new start.", 0, 95),
  ];
  current = entries.length - 1;
}
// The Design Studio drives this page from its preview frame: new theme choices and which screen to show.
addEventListener("message", (ev) => {
  if (ev.origin !== location.origin || !ev.data) return;
  if (ev.data.type === "theme") { applyTheme(ev.data.theme); if (map) map.resize(); }
  if (ev.data.type === "view") {
    if (ev.data.view === "cover") { show("cover"); return; }
    if (ev.data.view === "making") {
      show("making");
      const mark = steps([["Reading your words", "Feelings and key moments, found in your browser."], ["Reading how you typed", "Speed, force, pauses and rhythm."],
        ["Connecting your thoughts", "Moth's <code>graph-v1</code> Quantum Graph engine measures each connection."], ["Composing your song", "Moth's <code>qrc-midi-v1</code> quantum reservoir writes the day's song."]]);
      mark(0, "done"); mark(1, "done"); mark(2, "now");
      return;
    }
    if (ev.data.view === "week") { show("week"); weekReview.example(); return; }
    show(ev.data.view);
  }
});

if (q.has("example")) { show("week"); weekReview.example(); if (q.has("forecast")) document.getElementById("wkForecastBtn").click(); }
if (q.get("view")) show(q.get("view"));
if (q.get("click")) document.getElementById(q.get("click"))?.click();   // test hook: simulate a button click
if (q.get("page") && flip) setTimeout(() => flip.turnToPage(+q.get("page")), 300);   // test hook: open the book at a page
if (q.has("wavtest") && entries.length) {   // test hook: render the current day's song and report the file in the page title
  const e = entries[current];
  player.renderWav(e.song, e.feelings.ranked[0] || "none", e.stats.force).then(async (blob) => {
    const v = new DataView(await blob.slice(0, 44).arrayBuffer());
    document.title = `WAV ${blob.size} bytes, ${v.getUint32(24, true)} Hz, ${v.getUint16(22, true)} ch, ${(blob.size - 44) / 4 / v.getUint32(24, true)} s`;
  }).catch((err) => (document.title = "WAV error: " + err.message));
}
// ?live: write one example entry with simulated typing and run it through the REAL engines (end-to-end test)
if (q.has("live")) {
  const body = "Today was long. I was so nervous about the test but my friends made me laugh at lunch. Walked home in the rain and felt calm. I hope tomorrow is better.";
  const ev = []; let t = 0; for (const ch of body) { t += 120 + ((ch.charCodeAt(0) * 37) % 90) + (ch === "." ? 900 : 0); ev.push({ t, key: ch, kind: "char", shift: /[A-Z]/.test(ch) }); }
  makeEntry(body, ev);
}
