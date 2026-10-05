// Weekly review: the last 7 days at a glance, a merged brain map, the week's song, and a playful QRC forecast.
import { typingStats, feelings, moments, linksFor, typingMood, FINGER_MOODS, moodColour } from "./analyse.js";
import { typingMelody } from "./music.js";
import { BrainMap } from "./brainmap.js";

const $ = (s) => document.querySelector(s);
const DAY = 864e5;
const dayName = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short" });
const moodOf = (e) => e.feelings.ranked[0] || null;
const colour = (m) => moodColour(m);

// ---------- an example week (simulated typing; no engine calls) so anyone can see the review ----------
function simulate(body, daysAgo, { speed, jitter = 40, erases = 0, pauses = 0 }) {
  const ev = []; let t = 0, k = 0;
  for (const ch of body) {
    t += speed + ((ch.charCodeAt(0) * 37 + k * 11) % jitter) + (ch === "." ? 400 : 0);
    if (pauses && k % Math.floor(body.length / pauses) === 7) t += 2200;
    ev.push({ t, key: ch, kind: "char", shift: /[A-Z]/.test(ch) });
    if (erases && k % Math.floor(body.length / erases) === 5) { t += 90; ev.push({ t, key: "", kind: "erase" }); }
    k++;
  }
  const feel = feelings(body), ms = moments(body), links = linksFor(ms), stats = typingStats(ev);
  return { id: `ex${daysAgo}`, example: true, date: Date.now() - daysAgo * DAY, text: body, feelings: feel, stats, moments: ms, links,
    strengths: links.map((_, i) => 0.25 + ((i * 41) % 70) / 100), seed: daysAgo,
    song: { ...typingMelody(ev, feel.ranked[0] || "none", stats), source: "example (simulated typing)" }, graph: { engine: "none", note: "example entry" } };
}
export function exampleWeek() {
  return [
    simulate("New week. Couldn't sleep and the maths test is in three days. I feel so behind and stressed about everything.", 6, { speed: 130, erases: 9, pauses: 4 }),
    simulate("Better day. Maya and I laughed so much at lunch. The best part was the walk home in the sun.", 5, { speed: 95, jitter: 30 }),
    simulate("Tired. Revision all evening. I miss summer. Mum made tea and we watched a film which helped.", 4, { speed: 210, jitter: 60, pauses: 2 }),
    simulate("TEST DAY. I was so nervous my hands were shaking!! But I think I actually did okay?? Ugh the last question was so unfair.", 3, { speed: 70, erases: 6 }),
    simulate("It's done. Went to the park with friends and played football until it got dark. Felt free and happy.", 2, { speed: 90 }),
    simulate("Rainy day. Stayed in bed with my cat, read a book, had tea. Quiet and calm. Exactly what I needed.", 1, { speed: 170, jitter: 20 }),
    simulate("Planning next week. I want to start running and try to be braver about speaking in class. New goals, new start.", 0, { speed: 105 }),
  ];
}

// ---------- the review ----------
export function setupWeek({ getEntries, player, job }) {
  let showingExample = false, week = [], map = null;

  function render() {
    player.stop(); $("#wkPlay").textContent = "Play your week";
    const mine = getEntries().filter((e) => Date.now() - e.date < 7 * DAY);
    week = showingExample ? exampleWeek() : mine;
    $("#wkExampleNote").hidden = !showingExample;
    const enough = week.length >= 2;
    $("#wkEmpty").hidden = enough; $("#wkBody").hidden = !enough;
    if (!enough) { $("#wkRange").textContent = ""; return; }
    week.sort((a, b) => a.date - b.date);
    $("#wkRange").textContent = `${new Date(week[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} – ${new Date(week[week.length - 1].date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · ${week.length} entries`;
    timeline(); cards(); weekMap();
    $("#wkForecast").innerHTML = $("#wkForecast").innerHTML.includes("fc-days") ? forecastIntro() : $("#wkForecast").innerHTML;
    $("#wkForecastBtn").onclick = forecast;
  }

  function timeline() {
    const maxForce = Math.max(...week.map((e) => e.stats.force), 0.3);
    $("#wkTimeline").innerHTML = week.map((e) => {
      const m = moodOf(e), f = typingMood(e.stats), fc = moodColour((FINGER_MOODS[f.label] || {}).mood || "none");
      return `<div class="day"><div class="dot" style="background:rgb(${colour(m)});color:rgb(${colour(m)})"></div>
        <div class="bar"><i style="height:${Math.max(8, (e.stats.force / maxForce) * 100)}%;background:rgb(${fc})"></i></div>
        <b>${dayName(e.date)}</b>${m || "reflective"}<br><span style="opacity:.7">typing: ${f.label}</span></div>`;
    }).join("");
  }

  function cards() {
    const count = {}; for (const e of week) for (const m of e.feelings.ranked.slice(0, 1)) count[m] = (count[m] || 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    const byForce = [...week].sort((a, b) => a.stats.force - b.stats.force);
    const words = {}; for (const e of week) for (const m of e.moments) words[m.w] = (words[m.w] || 0) + 1;
    const topic = Object.entries(words).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
    const happy = week.flatMap((e) => e.moments.filter((m) => ["happy", "love", "excited"].includes(m.mood)).map((m) => ({ m, e })))[0];
    const fingers = {}; for (const e of week) { const l = typingMood(e.stats).label; fingers[l] = (fingers[l] || 0) + 1; }
    const topFinger = Object.entries(fingers).sort((a, b) => b[1] - a[1])[0];
    const c = (label, value, note) => `<div class="card"><small>${label}</small><div>${value}</div>${note ? `<p>${note}</p>` : ""}</div>`;
    $("#wkCards").innerHTML = [
      c("Most common feeling", top ? top[0] : "reflective", top ? `${top[1]} of ${week.length} days, from your words` : ""),
      c("How you typed, mostly", topFinger[0], `${topFinger[1]} of ${week.length} days`),
      c("Calmest day", dayName(byForce[0].date), `gentlest typing: force ${Math.round(byForce[0].stats.force * 100)}%`),
      c("Most intense day", dayName(byForce[byForce.length - 1].date), `hardest typing: force ${Math.round(byForce[byForce.length - 1].stats.force * 100)}%`),
      c("On your mind", topic ? topic[0] : "-", topic && topic[1] > 1 ? `came up on ${topic[1]} days` : "the strongest moment of the week"),
      c("A happy moment", happy ? happy.m.w : "-", happy ? dayName(happy.e.date) : "none found in your words this week"),
    ].join("");
  }

  // all days merged: up to 2 moments per day, linked within each day and across days by shared feeling or word
  function weekMap() {
    const ms = [], links = [], strengths = [], dayStart = [];
    for (const e of week) {
      dayStart.push(ms.length);
      e.moments.slice(0, 2).forEach((m, i) => { ms.push({ ...m, day: dayName(e.date) }); if (i) { links.push([ms.length - 2, ms.length - 1]); strengths.push(e.strengths?.[0] ?? 0.5); } });
    }
    for (let d = 1; d < dayStart.length; d++) { links.push([dayStart[d - 1], dayStart[d]]); strengths.push(0.35); }
    ms.forEach((m, i) => ms.forEach((n, j) => { if (j > i + 1 && links.length < 40 && (m.w === n.w || (m.mood && m.mood === n.mood && m.day !== n.day))) { links.push([i, j]); strengths.push(m.w === n.w ? 1 : 0.6); } }));
    const merged = { moments: ms, links, strengths, feelings: { ranked: [...new Set(week.map(moodOf).filter(Boolean))] },
      song: { bpm: Math.round(week.reduce((s, e) => s + e.song.bpm, 0) / week.length) } };
    if (!map) map = new BrainMap($("#wkMap")); else map.resize();
    map.show(merged, player);
    // the week's song: each day's own (quantum-made) song, one after another
    let t = 0; const notes = [];
    for (const e of week) { const part = e.song.notes.slice(0, 16), start = part[0]?.[0] || 0; for (const [s, d, p, v] of part) notes.push([t + s - start, d, p, v]); t += Math.max(4, Math.ceil((part.at(-1)?.[0] ?? 0) - start + 1)); }
    merged.song.notes = notes; this_song = merged.song;
    $("#wkSongInfo").textContent = `${week.length} days, each day's song in order · ${merged.song.bpm} bpm`;
  }
  let this_song = null;

  $("#wkPlay").onclick = () => {
    if (player.playing) { player.stop(); $("#wkPlay").textContent = "Play your week"; return; }
    const top = week.map(moodOf).filter(Boolean)[0] || "none", force = week.reduce((s, e) => s + e.stats.force, 0) / week.length;
    player.play(this_song, top, force); $("#wkPlay").textContent = "Stop";
  };

  // ---------- forecast: moods → notes → qrc-midi-v1 continues the pattern → notes back to moods ----------
  const ORDER = ["happy", "excited", "love", "hopeful", "calm", "anxious", "sad", "angry"];
  const forecastIntro = () => `<p class="small">A quantum reservoir (Moth's <code>qrc-midi-v1</code>) learns the order of your moods this week and continues the pattern.
    It's learning from one week, so treat it like a horoscope, not a prediction.</p><button class="btn" id="wkForecastBtn">Make my forecast</button>`;
  async function forecast() {
    const seq = week.map(moodOf).map((m) => ORDER.indexOf(m)).filter((i) => i >= 0);
    if (seq.length < 2) { $("#wkForecast").innerHTML = `<p>Not enough feelings in your words this week to learn a pattern yet.</p>`; return; }
    const looped = []; while (looped.length < 12) looped.push(...seq);
    const notes = looped.slice(0, 16).map((i, k) => [k * 0.5, 0.5, 60 + i * 2, 90]);
    $("#wkForecast").innerHTML = `<p>The quantum reservoir is learning your week… (about 25 seconds)</p>`;
    try {
      const { out, job_id } = await job("/api/diary/song", { bpm: 90, notes, velocity: 90, seed: seq.reduce((s, x) => s * 9 + x, 7) % 2147483647 }, "notes");
      const moods = out.notes.slice(0, 3).map(([, , p]) => ORDER[Math.max(0, Math.min(ORDER.length - 1, Math.round((p - 60) / 2)))]);
      const days = [1, 2, 3].map((k) => new Date(Date.now() + k * DAY).toLocaleDateString("en-GB", { weekday: "long" }));
      $("#wkForecast").innerHTML = `<div class="fc-days">${moods.map((m, k) => `<div><span>${days[k]}</span><b style="color:rgb(${colour(m)})">${m}</b></div>`).join("")}</div>
        <p class="small">Learned from the order of your ${seq.length} moods this week by Moth's QRC quantum reservoir (qrc-midi-v1) · job ${job_id.slice(0, 8)}… ·
        just for fun: one week is far too little to really predict anyone's feelings.</p>
        <button class="btn secondary tiny" id="wkForecastBtn">Forecast again</button>`;
    } catch (err) {
      $("#wkForecast").innerHTML = `<p>The quantum engine is busy right now. Try again in a minute.</p><button class="btn secondary tiny" id="wkForecastBtn">Try again</button>`;
    }
    $("#wkForecastBtn").onclick = forecast;
  }

  $("#wkExample").onclick = () => { showingExample = true; render(); };
  $("#wkMine").onclick = () => { showingExample = false; render(); };
  return { render, example: () => { showingExample = true; render(); } };
}
