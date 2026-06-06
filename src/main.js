import Globe from "globe.gl";
import { Color, Group, Sprite, SpriteMaterial, CanvasTexture } from "three";
import { geoCentroid } from "d3-geo";
import "./style.css";
import { ALIASES } from "./aliases.js";
import { CITIES, CITY_ALIASES } from "./cities.js";
import { buildHints, buildCityHints } from "./hints.js";
import { KOFI_URL, KOFI_SHOP_URL, PRO_PRICE, VALID_PRO_CODES, PRO_STORAGE_KEY, SITE_URL } from "./config.js";

/* ------------------------------------------------------------------ *
 *  QUESTATE — a globe-guessing quest
 * ------------------------------------------------------------------ */

const MAX_REF_KM = 13000;        // distance that maps to "ice cold" (countries)
const MAX_REF_KM_CITY = 3500;    // tighter scale inside a single country
const EARTH_R = 6371;

const COUNTRY_FLAGS = { USA: "🇺🇸", Canada: "🇨🇦", UK: "🇬🇧", Spain: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const el = (id) => document.getElementById(id);
const ui = {
  loading: el("loading"),
  hint: el("hint"),
  input: el("guessInput"),
  form: el("guessForm"),
  suggest: el("suggest"), suggestName: el("suggestName"), suggestYes: el("suggestYes"), suggestNo: el("suggestNo"),
  closestPanel: el("closestPanel"), closestName: el("closestName"), closestKm: el("closestKm"),
  closestDir: el("closestDir"), proximityFill: el("proximityFill"),
  feedPanel: el("feedPanel"), feedList: el("feedList"), guessCount: el("guessCount"),
  topBar: el("topBar"), inputBar: el("inputBar"), gameReadout: el("gameReadout"),
  coffeeBtn: el("coffeeBtn"), menuBtn: el("menuBtn"),
  winOverlay: el("winOverlay"), winTitle: el("winTitle"), winBurst: el("winBurst"),
  winCountry: el("winCountry"), winStats: el("winStats"), winAgain: el("winAgain"),
  winMenu: el("winMenu"), winShare: el("winShare"), dailyBtn: el("dailyBtn"),
  hintBtn: el("hintBtn"), forfeitBtn: el("forfeitBtn"),
  hintBox: el("hintBox"), hintTag: el("hintTag"), hintText: el("hintText"),
  // menu
  menu: el("menu"), modeChoice: el("modeChoice"), citiesProBadge: el("citiesProBadge"),
  countrySection: el("countrySection"), countryChoice: el("countryChoice"),
  diffChoice: el("diffChoice"), playBtn: el("playBtn"), menuCoffee: el("menuCoffee"), proStatus: el("proStatus"),
  // unlock
  unlock: el("unlock"), unlockClose: el("unlockClose"), proPrice: el("proPrice"),
  unlockBuy: el("unlockBuy"), unlockForm: el("unlockForm"), codeInput: el("codeInput"), unlockMsg: el("unlockMsg"),
};

/* ---------------- state ---------------- */
const state = {
  sets: { countries: { pool: [], byNorm: new Map() } }, // cities sets added per country: sets["city:USA"] ...
  cityCountries: [],
  gameType: "countries",       // "countries" | "cities"
  cityCountry: null,           // chosen country in cities mode
  pool: [],
  byNorm: new Map(),
  maxRef: MAX_REF_KM,
  target: null,
  guessed: new Map(),
  mode: "easy",
  solved: false,
  pendingSuggestion: null,
  hints: [],
  hintIndex: 0,
  daily: false,
  dailyTarget: null,
  dailyNumber: 0,
};
// menu selections (before a game starts)
const menuSel = { mode: "countries", country: null, diff: "easy" };
const noun = () => (state.gameType === "cities" ? "city" : "country");

let globe, controls;

/* ---------------- pro unlock ---------------- */
const isPro = () => localStorage.getItem(PRO_STORAGE_KEY) === "1";
function grantPro() { localStorage.setItem(PRO_STORAGE_KEY, "1"); }

/* ---------------- helpers ---------------- */
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (deg) => COMPASS[Math.round(deg / 45) % 8];

function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

const proximity = (km) => Math.max(0, 1 - km / state.maxRef);

function heatRGB(p) {
  const stops = [[0.0, [43, 77, 255]], [0.45, [0, 224, 198]], [0.7, [255, 207, 92]], [0.88, [255, 138, 60]], [1.0, [255, 59, 48]]];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const t = (p - lo[0]) / (hi[0] - lo[0] || 1);
  return lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * t));
}
const heatColor = (p, alpha = 0.9) => `rgba(${heatRGB(p).join(",")},${alpha})`;
const TARGET_RGB = [46, 230, 166];

const MERGE_INTO = { "Israel": "Palestine" };
const effName = (f) => MERGE_INTO[f.__name] || f.__name;

/* ---------------- matching ---------------- */
function resolveGuess(raw) {
  const q = norm(raw);
  if (!q) return { type: "unknown" };
  if (state.byNorm.has(q)) return { type: "exact", country: state.byNorm.get(q) };

  let best = null, bestD = 99, second = 99;
  for (const [key, country] of state.byNorm) {
    if (Math.abs(key.length - q.length) > 3) continue;
    const d = lev(q, key);
    if (d < bestD) { second = bestD; bestD = d; best = country; }
    else if (d < second) { second = d; }
  }
  const allow = q.length >= 7 ? 2 : 1;
  const tooShort = q.length < 4;
  const ambiguous = second - bestD < 1;
  if (!tooShort && best && bestD <= allow && bestD / q.length <= 0.34 && !ambiguous) {
    return { type: "suggest", country: best };
  }
  return { type: "unknown" };
}

/* ---------------- game flow ---------------- */
function commitGuess(country) {
  if (state.solved || state.guessed.has(country.name)) {
    if (state.guessed.has(country.name)) flash(`You already guessed ${country.name}.`, "warn");
    return;
  }
  const km = country === state.target ? 0 : haversine(country, state.target);
  const p = proximity(km);
  state.guessed.set(country.name, { country, km, proximity: p });

  render();
  flyTo(country);
  addFeedItem(country, km, p);
  updateClosest();
  ui.feedPanel.hidden = false;
  ui.closestPanel.hidden = false;

  if (country === state.target) return win();
  flash(`${country.name}, ${fmtKm(km)} away`, "ok");
}

function endGame() { state.solved = true; ui.hintBtn.disabled = true; ui.forfeitBtn.disabled = true; }

function win() {
  endGame();
  ui.winBurst.textContent = "◉";
  ui.winBurst.style.color = "var(--good)";
  ui.winTitle.textContent = "SOLVED";
  ui.winCountry.textContent = state.target.name;
  const n = state.guessed.size;
  ui.winStats.textContent = `${n} guess${n === 1 ? "" : "es"} · ${state.mode.toUpperCase()} mode`;
  showWinButtons();
  ui.winOverlay.hidden = false;
  render();
  flyTo(state.target, 1.6);
}

function showWinButtons() {
  ui.winShare.hidden = !state.daily;       // share only for the daily
  ui.winShare.textContent = "📋 Share result";
  ui.winAgain.hidden = state.daily;        // replaying the same daily is pointless
}

function forfeit() {
  if (state.solved) return;
  endGame();
  render();
  ui.winBurst.textContent = "🏳️";
  ui.winBurst.style.color = "var(--warn)";
  ui.winTitle.textContent = "REVEALED";
  ui.winCountry.textContent = state.target.name;
  const n = state.guessed.size;
  ui.winStats.textContent = n
    ? `You gave up after ${n} guess${n === 1 ? "" : "es"}. It was right here. 🫡`
    : "You gave up before even guessing. Bold. 🫡";
  showWinButtons();
  ui.winOverlay.hidden = false;
  globe.pointOfView({ lat: state.target.lat, lng: state.target.lng, altitude: 1.6 }, 900);
}

function revealHint() {
  if (state.solved) return;
  if (state.hintIndex >= state.hints.length) {
    ui.hintText.textContent = "That's everything I've got. You're on your own now, captain. 🫡";
    ui.hintTag.textContent = "NO MORE";
    ui.hintBtn.disabled = true;
    return;
  }
  ui.hintTag.textContent = `HINT ${state.hintIndex + 1}/${state.hints.length}`;
  ui.hintText.textContent = state.hints[state.hintIndex];
  ui.hintBox.hidden = false;
  state.hintIndex++;
  if (state.hintIndex >= state.hints.length) ui.hintBtn.textContent = "💡 Hint (last one!)";
}

function newGame() {
  state.target = state.daily && state.dailyTarget
    ? state.dailyTarget
    : state.pool[Math.floor(Math.random() * state.pool.length)];
  state.guessed.clear();
  state.solved = false;
  state.pendingSuggestion = null;
  state.hints = state.gameType === "cities" ? buildCityHints(state.target, state.pool) : buildHints(state.target);
  state.hintIndex = 0;
  ui.hintBtn.disabled = false;
  ui.forfeitBtn.disabled = false;
  ui.hintBtn.textContent = "💡 Hint";
  ui.hintBox.hidden = true;
  ui.feedList.innerHTML = "";
  ui.guessCount.textContent = "0";
  ui.feedPanel.hidden = true;
  ui.closestPanel.hidden = true;
  ui.suggest.hidden = true;
  ui.winOverlay.hidden = true;
  ui.hint.textContent = "";
  ui.input.value = "";
  ui.input.focus();
  render();
  // frame the playing field
  if (state.gameType === "cities") {
    globe.pointOfView({ lat: state.target.lat, lng: state.target.lng, altitude: 1.4 }, 1200);
  } else {
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1200);
  }
  // dev aid: console.log("target:", state.target.name);
}

/* ---------------- menu / start ---------------- */
function showMenu() {
  // clear any in-progress board
  state.target = null;
  state.guessed.clear();
  state.solved = false;
  if (globe) { render(); controls.autoRotate = true; globe.pointOfView({ altitude: 2.5 }, 1000); }
  ui.topBar.hidden = true;
  ui.inputBar.hidden = true;
  ui.closestPanel.hidden = true;
  ui.feedPanel.hidden = true;
  ui.winOverlay.hidden = true;
  refreshMenuLocks();
  applyMenuSelectionUI();
  ui.menu.hidden = false;
}

function refreshMenuLocks() {
  const pro = isPro();
  const citiesBtn = ui.modeChoice.querySelector('[data-mode="cities"]');
  citiesBtn.classList.toggle("locked", !pro);
  ui.citiesProBadge.textContent = pro ? "✓ PRO" : "🔒 PRO";
  ui.citiesProBadge.classList.toggle("owned", pro);
  ui.proStatus.textContent = pro ? "Cities mode unlocked ✓" : `Cities mode is Pro · ${PRO_PRICE}`;
}

function applyMenuSelectionUI() {
  [...ui.modeChoice.children].forEach((b) => b.classList.toggle("is-active", b.dataset.mode === menuSel.mode));
  [...ui.diffChoice.children].forEach((b) => b.classList.toggle("is-active", b.dataset.diff === menuSel.diff));
  ui.countrySection.hidden = menuSel.mode !== "cities";
  [...ui.countryChoice.children].forEach((b) => b.classList.toggle("is-active", b.dataset.country === menuSel.country));
}

function startGame() {
  state.daily = false;
  if (menuSel.mode === "cities") {
    if (!isPro()) { openUnlock(); return; }
    if (!menuSel.country) { pulse(ui.countrySection); return; }
    const set = state.sets["city:" + menuSel.country];
    state.gameType = "cities";
    state.cityCountry = menuSel.country;
    state.pool = set.pool;
    state.byNorm = set.byNorm;
    state.maxRef = MAX_REF_KM_CITY;
    ui.input.placeholder = `Type a city in ${menuSel.country} and press Enter…`;
  } else {
    state.gameType = "countries";
    state.cityCountry = null;
    state.pool = state.sets.countries.pool;
    state.byNorm = state.sets.countries.byNorm;
    state.maxRef = MAX_REF_KM;
    ui.input.placeholder = "Type a country and press Enter…";
  }
  state.mode = menuSel.diff;
  document.body.classList.toggle("is-hard", state.mode === "hard");
  ui.gameReadout.textContent = state.gameType === "cities"
    ? `📍 ${COUNTRY_FLAGS[state.cityCountry] || ""} ${state.cityCountry} · ${cap(state.mode)}`
    : `🌐 Countries · ${cap(state.mode)}`;

  ui.menu.hidden = true;
  ui.topBar.hidden = false;
  ui.inputBar.hidden = false;
  controls.autoRotate = false;
  newGame();
}

/* ---------------- daily challenge ---------------- */
const DAILY_EPOCH = Date.UTC(2025, 0, 1); // day 0
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickDaily() {
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNum = Math.floor((todayUTC - DAILY_EPOCH) / 86400000);
  const sorted = [...state.sets.countries.pool].sort((a, b) => a.name.localeCompare(b.name));
  const idx = Math.floor(mulberry32(dayNum + 1)() * sorted.length);
  return { country: sorted[idx], number: dayNum + 1 };
}
function startDaily() {
  const { country, number } = pickDaily();
  state.daily = true;
  state.dailyTarget = country;
  state.dailyNumber = number;
  state.gameType = "countries";
  state.cityCountry = null;
  state.pool = state.sets.countries.pool;
  state.byNorm = state.sets.countries.byNorm;
  state.maxRef = MAX_REF_KM;
  state.mode = menuSel.diff;
  document.body.classList.toggle("is-hard", state.mode === "hard");
  ui.input.placeholder = "Type a country and press Enter…";
  ui.gameReadout.textContent = `🗓️ Daily #${number} · ${cap(state.mode)}`;
  ui.menu.hidden = true;
  ui.topBar.hidden = false;
  ui.inputBar.hidden = false;
  controls.autoRotate = false;
  newGame();
}

const SHARE_SQUARES = [
  [0.99, "🎯"], [0.82, "🟥"], [0.62, "🟧"], [0.42, "🟨"], [0.22, "🟦"], [0, "⬜"],
];
const square = (p) => (SHARE_SQUARES.find(([t]) => p >= t) || ["", "⬜"])[1];

function buildShareText() {
  const squares = [...state.guessed.values()].map((g) => square(g.proximity)).join("");
  const n = state.guessed.size;
  const hard = state.mode === "hard" ? " (Hard)" : "";
  const line = state.solved && state.guessed.has(state.target.name)
    ? `Solved in ${n}${hard}`
    : `Gave up after ${n}${hard}`;
  let txt = `🌍 Questate Daily #${state.dailyNumber}\n${line}\n${squares}`;
  if (SITE_URL) txt += `\n${SITE_URL}`;
  return txt;
}
async function shareResult() {
  const text = buildShareText();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    ui.winShare.textContent = "✓ Copied!";
    setTimeout(() => (ui.winShare.textContent = "📋 Share result"), 1800);
  } catch {
    ui.winShare.textContent = "✓ Copied!";
    setTimeout(() => (ui.winShare.textContent = "📋 Share result"), 1800);
  }
}

/* ---------------- unlock modal ---------------- */
function openUnlock() { ui.unlockMsg.textContent = ""; ui.codeInput.value = ""; ui.unlock.hidden = false; ui.codeInput.focus(); }
function closeUnlock() { ui.unlock.hidden = true; }
function tryUnlock(raw) {
  const code = raw.trim().toUpperCase();
  if (VALID_PRO_CODES.map((c) => c.toUpperCase()).includes(code)) {
    grantPro();
    ui.unlockMsg.textContent = "Unlocked! Cities mode is now available 🎉";
    ui.unlockMsg.className = "unlock-msg ok";
    refreshMenuLocks();
    menuSel.mode = "cities";
    applyMenuSelectionUI();
    setTimeout(closeUnlock, 1100);
  } else {
    ui.unlockMsg.textContent = "That code didn't work. Double-check and try again.";
    ui.unlockMsg.className = "unlock-msg err";
  }
}

/* ---------------- rendering ---------------- */
function paintGlobe() {
  globe
    .polygonCapColor((f) => {
      const name = effName(f);
      if (state.solved && state.target && name === state.target.name) return "rgba(46,230,166,0.95)";
      const g = state.guessed.get(name);
      if (g) return heatColor(g.proximity, 0.92);
      return "rgba(90,120,200,0.07)";
    })
    .polygonAltitude((f) => {
      const name = effName(f);
      if (state.solved && state.target && name === state.target.name) return 0.06;
      return state.guessed.has(name) ? 0.035 : 0.008;
    })
    .polygonStrokeColor((f) =>
      state.guessed.has(effName(f)) ? "rgba(255,255,255,0.55)" : "rgba(120,150,230,0.18)"
    );
}

function renderLabels() {
  if (state.gameType !== "cities") { globe.labelsData([]); return; }
  const labels = [...state.guessed.values()].map((g) => ({
    lat: g.country.lat, lng: g.country.lng, name: g.country.name,
    color: g.country === state.target ? "#2ee6a6" : heatColor(g.proximity, 1),
  }));
  if (state.solved && state.target && !state.guessed.has(state.target.name)) {
    labels.push({ lat: state.target.lat, lng: state.target.lng, name: state.target.name, color: "#2ee6a6" });
  }
  globe.labelsData(labels);
}

function render() { paintGlobe(); renderLabels(); }

function flyTo(country, altitude) {
  const alt = altitude ?? (state.gameType === "cities" ? 1.2 : 1.9);
  globe.pointOfView({ lat: country.lat, lng: country.lng, altitude: alt }, 900);
  const rgb = country === state.target ? TARGET_RGB
    : heatRGB(proximity(state.guessed.get(country.name)?.km ?? state.maxRef));
  globe.ringsData([
    ...globe.ringsData().filter((r) => Date.now() - r.t < 1800),
    { lat: country.lat, lng: country.lng, t: Date.now(), rgb },
  ]);
}

function updateClosest() {
  let best = null;
  for (const g of state.guessed.values()) if (!best || g.km < best.km) best = g;
  if (!best) return;
  ui.closestName.textContent = best.country.name;
  ui.closestKm.textContent = fmtKm(best.km);
  ui.proximityFill.style.width = `${(best.proximity * 100).toFixed(0)}%`;
  ui.proximityFill.style.background = `linear-gradient(90deg, #4d7cff, ${heatColor(best.proximity, 1)})`;
  if (state.mode === "easy" && best.km > 0) {
    const b = bearing(best.country, state.target);
    const arrow = `<span style="display:inline-block;transform:rotate(${b}deg);color:var(--accent-2)">↑</span>`;
    ui.closestDir.innerHTML = `${arrow} target is ${compass(b)} · ${Math.round(b)}°`;
  } else {
    ui.closestDir.textContent = state.mode === "hard" ? "direction hidden · hard mode" : "";
  }
}

function addFeedItem(country, km, p) {
  ui.guessCount.textContent = String(state.guessed.size);
  const li = document.createElement("li");
  li.className = "feed-item";
  const color = country === state.target ? "#2ee6a6" : heatColor(p, 1);
  const b = km === 0 ? 0 : bearing(country, state.target);
  const arrow = km === 0 ? ""
    : `<span class="fi-arrow" title="target is ${compass(b)} (${Math.round(b)}°) from ${country.name}" style="transform:rotate(${b}deg)">↑</span>`;
  const sub = country.country ? ` <span class="fi-sub">${country.country}</span>` : "";
  li.innerHTML = `
    <span class="fi-name"><span class="fi-dot" style="color:${color};background:${color}"></span>${country.name}${sub}</span>
    <span class="fi-right">${arrow}<span class="fi-km">${km === 0 ? "✓" : fmtKm(km)}</span></span>`;
  const items = [...ui.feedList.children];
  const ref = items.find((it) => Number(it.dataset.km) > km);
  li.dataset.km = km;
  ui.feedList.insertBefore(li, ref || null);
}

const fmtKm = (km) => `${Math.round(km).toLocaleString()} km`;

let hintTimer;
function flash(msg, kind = "") {
  ui.hint.textContent = msg;
  ui.hint.className = "hint" + (kind === "error" ? " is-error" : kind === "ok" ? " is-ok" : "");
  clearTimeout(hintTimer);
  if (kind === "ok" || kind === "warn") hintTimer = setTimeout(() => (ui.hint.textContent = ""), 3200);
}
function pulse(node) { node.classList.remove("pulse"); void node.offsetWidth; node.classList.add("pulse"); }

/* ---------------- events ---------------- */
ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (state.solved) return;
  const raw = ui.input.value.trim();
  if (!raw) return;
  ui.suggest.hidden = true;
  state.pendingSuggestion = null;
  const res = resolveGuess(raw);
  if (res.type === "exact") { ui.input.value = ""; commitGuess(res.country); }
  else if (res.type === "suggest") {
    state.pendingSuggestion = res.country;
    ui.suggestName.textContent = res.country.name;
    ui.suggest.hidden = false;
    flash(`Hmm, that's not quite a ${noun()}…`);
  } else {
    flash(`"${raw}" isn't a ${noun()} I know. Check the spelling (no turn lost).`, "error");
  }
});
ui.suggestYes.addEventListener("click", () => {
  if (!state.pendingSuggestion) return;
  ui.suggest.hidden = true; ui.input.value = "";
  const c = state.pendingSuggestion; state.pendingSuggestion = null; commitGuess(c);
});
ui.suggestNo.addEventListener("click", () => { ui.suggest.hidden = true; state.pendingSuggestion = null; ui.input.focus(); });

ui.hintBtn.addEventListener("click", revealHint);
ui.forfeitBtn.addEventListener("click", forfeit);
ui.winAgain.addEventListener("click", newGame);
ui.winMenu.addEventListener("click", showMenu);
ui.menuBtn.addEventListener("click", showMenu);
ui.dailyBtn.addEventListener("click", startDaily);
ui.winShare.addEventListener("click", shareResult);

// menu choices
ui.modeChoice.addEventListener("click", (e) => {
  const btn = e.target.closest(".choice"); if (!btn) return;
  if (btn.dataset.mode === "cities" && !isPro()) { openUnlock(); return; }
  menuSel.mode = btn.dataset.mode;
  applyMenuSelectionUI();
});
ui.countryChoice.addEventListener("click", (e) => {
  const btn = e.target.closest(".choice"); if (!btn) return;
  menuSel.country = btn.dataset.country;
  applyMenuSelectionUI();
});
ui.diffChoice.addEventListener("click", (e) => {
  const btn = e.target.closest(".choice"); if (!btn) return;
  menuSel.diff = btn.dataset.diff;
  applyMenuSelectionUI();
});
ui.playBtn.addEventListener("click", startGame);

// unlock modal
ui.unlockClose.addEventListener("click", closeUnlock);
ui.unlock.addEventListener("click", (e) => { if (e.target === ui.unlock) closeUnlock(); });
ui.unlockForm.addEventListener("submit", (e) => { e.preventDefault(); tryUnlock(ui.codeInput.value); });

/* ---------------- background visuals ---------------- */
const ARC_PALETTES = [
  ["rgba(0,224,198,0)", "rgba(0,224,198,0.75)", "rgba(0,224,198,0)"],
  ["rgba(77,124,255,0)", "rgba(77,124,255,0.75)", "rgba(77,124,255,0)"],
  ["rgba(168,120,255,0)", "rgba(168,120,255,0.65)", "rgba(168,120,255,0)"],
  ["rgba(46,230,166,0)", "rgba(46,230,166,0.7)", "rgba(46,230,166,0)"],
];
function makeDecoArcs(n) {
  const rnd = () => ({ lat: Math.random() * 160 - 80, lng: Math.random() * 360 - 180 });
  return Array.from({ length: n }, () => {
    const a = rnd(), b = rnd();
    return {
      startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng,
      colors: ARC_PALETTES[Math.floor(Math.random() * ARC_PALETTES.length)],
      alt: 0.14 + Math.random() * 0.28,
      speed: 3000 + Math.random() * 4500,
    };
  });
}

function makeEmojiSprite(emoji) {
  const size = 128;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.font = `${size * 0.72}px serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + 6);
  const tex = new CanvasTexture(c);
  const mat = new SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false });
  return new Sprite(mat);
}

/* comical objects that slowly orbit behind the globe */
function addOrbiters() {
  const scene = globe.scene();
  const group = new Group();
  group.rotation.x = 0.4;
  const emojis = ["🚀", "🛰️", "🛸", "🎈", "🪐", "✈️"];
  const R = 128;
  emojis.forEach((e, i) => {
    const sp = makeEmojiSprite(e);
    const phi = Math.acos(1 - 2 * (i + 0.5) / emojis.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    sp.position.set(R * Math.sin(phi) * Math.cos(theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
    const s = 9 + Math.random() * 4;
    sp.scale.set(s, s, 1);
    group.add(sp);
  });
  scene.add(group);
  const tick = () => { group.rotation.y += 0.0011; requestAnimationFrame(tick); };
  tick();
}

/* ---------------- boot ---------------- */
function buildCountrySet(country) {
  const pool = CITIES.filter((c) => c.country === country);
  const byNorm = new Map();
  for (const c of pool) byNorm.set(norm(c.name), c);
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    const c = byNorm.get(norm(canonical));
    if (c) byNorm.set(norm(alias), c);
  }
  return { pool, byNorm };
}

async function boot() {
  ui.coffeeBtn.href = KOFI_URL;
  ui.menuCoffee.href = KOFI_URL;
  ui.unlockBuy.href = KOFI_SHOP_URL;
  ui.proPrice.textContent = PRO_PRICE;

  const res = await fetch("/countries.geojson");
  const geo = await res.json();

  for (const f of geo.features) {
    const name = f.properties.ADMIN || f.properties.NAME;
    if (!name || name === "Antarctica") continue;
    const [lng, lat] = geoCentroid(f);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    f.__name = name;
    if (MERGE_INTO[name]) continue; // Israel renders but isn't guessable (shown as Palestine)
    const country = { name, iso2: f.properties.ISO_A2, feature: f, lat, lng };
    state.sets.countries.pool.push(country);
    state.sets.countries.byNorm.set(norm(name), country);
  }
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    const c = state.sets.countries.byNorm.get(norm(canonical));
    if (c) state.sets.countries.byNorm.set(norm(alias), c);
  }

  // per-country city sets
  state.cityCountries = [...new Set(CITIES.map((c) => c.country))];
  for (const country of state.cityCountries) state.sets["city:" + country] = buildCountrySet(country);

  // populate menu country chooser
  ui.countryChoice.innerHTML = state.cityCountries.map((c) =>
    `<button class="choice" data-country="${c}"><span class="choice-emoji">${COUNTRY_FLAGS[c] || "🏳️"}</span> ${c}</button>`
  ).join("");

  state.pool = state.sets.countries.pool;
  state.byNorm = state.sets.countries.byNorm;

  globe = Globe()(el("globe"))
    .backgroundColor("rgba(0,0,0,0)")
    .showAtmosphere(true).atmosphereColor("#4d7cff").atmosphereAltitude(0.2)
    .showGlobe(true)
    .polygonsData(geo.features.filter((f) => f.__name))
    .polygonCapColor(() => "rgba(90,120,200,0.07)")
    .polygonSideColor(() => "rgba(40,60,120,0.25)")
    .polygonStrokeColor(() => "rgba(120,150,230,0.18)")
    .polygonAltitude(0.008)
    .polygonsTransitionDuration(450)
    .ringColor((r) => (t) => `rgba(${r.rgb.join(",")},${1 - t})`)
    .ringMaxRadius(5).ringPropagationSpeed(3).ringRepeatPeriod(700)
    .arcColor((d) => d.colors)
    .arcStroke(0.42)
    .arcAltitude((d) => d.alt)
    .arcDashLength(0.4).arcDashGap(2)
    .arcDashInitialGap(() => Math.random() * 4)
    .arcDashAnimateTime((d) => d.speed)
    .arcsTransitionDuration(0)
    .arcsData(makeDecoArcs(20))
    .labelLat((d) => d.lat).labelLng((d) => d.lng).labelText((d) => d.name)
    .labelColor((d) => d.color).labelDotRadius(0.32).labelSize(0.95)
    .labelResolution(2).labelAltitude(0.012).labelsTransitionDuration(300)
    .labelsData([]);

  const mat = globe.globeMaterial();
  mat.color = new Color("#0a1024");
  mat.emissive = new Color("#0a1430");
  mat.emissiveIntensity = 0.25;
  mat.shininess = 8;

  controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.enableDamping = true;

  addOrbiters();

  const resize = () => globe.width(window.innerWidth).height(window.innerHeight);
  window.addEventListener("resize", resize);
  resize();

  setInterval(() => globe.arcsData(makeDecoArcs(20)), 10000);

  showMenu();
  ui.loading.classList.add("is-hidden");
  setTimeout(() => (ui.loading.hidden = true), 700);
}

boot().catch((err) => {
  console.error(err);
  ui.loading.innerHTML = `<span style="color:#ff5a4d">Failed to load: ${err.message}</span>`;
});
