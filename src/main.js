import Globe from "globe.gl";
import { Color, Group, Sprite, SpriteMaterial, CanvasTexture, Vector3 } from "three";
import { geoCentroid } from "d3-geo";
import "./style.css";
import { ALIASES } from "./aliases.js";
import { CITY_ALIASES } from "./cities.js";
import { buildHints, buildCityHints } from "./hints.js";
import { KOFI_URL, KOFI_SHOP_URL, PRO_PRICE, VALID_PRO_CODES, PRO_STORAGE_KEY, SITE_URL, PARTY_HOST, MULTIPLAYER_ENABLED } from "./config.js";
import { PartySocket } from "partysocket";

/* ------------------------------------------------------------------ *
 *  GUESSTATE — guess the place on the globe
 * ------------------------------------------------------------------ */

const MAX_REF_KM = 13000;        // distance that maps to "ice cold" (countries)
const MAX_REF_KM_CITY = 3500;    // tighter scale inside a single country
const EARTH_R = 6371;

const COUNTRY_FLAGS = { USA: "🇺🇸", Canada: "🇨🇦", UK: "🇬🇧", Spain: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const isMobile = () => window.innerWidth <= 720;
// zoom the camera out a bit on phones so panels don't crowd the highlighted area
const camAlt = (base) => (isMobile() ? base * 1.45 : base);

const el = (id) => document.getElementById(id);
const ui = {
  loading: el("loading"),
  hint: el("hint"),
  input: el("guessInput"),
  form: el("guessForm"),
  suggest: el("suggest"), suggestName: el("suggestName"), suggestYes: el("suggestYes"), suggestNo: el("suggestNo"),
  closestPanel: el("closestPanel"), closestName: el("closestName"), closestKm: el("closestKm"),
  closestDir: el("closestDir"), proximityFill: el("proximityFill"),
  feedPanel: el("feedPanel"), feedList: el("feedList"), guessCount: el("guessCount"), feedHead: el("feedHead"),
  topBar: el("topBar"), inputBar: el("inputBar"), gameReadout: el("gameReadout"),
  coffeeBtn: el("coffeeBtn"), menuBtn: el("menuBtn"),
  winOverlay: el("winOverlay"), winTitle: el("winTitle"), winBurst: el("winBurst"),
  winCountry: el("winCountry"), winStats: el("winStats"), winAgain: el("winAgain"),
  winMenu: el("winMenu"), winShare: el("winShare"), winSupport: el("winSupport"),
  // two-step menu
  menuStep1: el("menuStep1"), menuStep2: el("menuStep2"), menuBack: el("menuBack"),
  cardDaily: el("cardDaily"), cardFriends: el("cardFriends"), cardFree: el("cardFree"),
  hintBtn: el("hintBtn"), forfeitBtn: el("forfeitBtn"),
  hintBox: el("hintBox"), hintTag: el("hintTag"), hintText: el("hintText"),
  // multiplayer
  mpSetup: el("mpSetup"), mpSetupClose: el("mpSetupClose"), mpName: el("mpName"),
  mpCreate: el("mpCreate"), mpJoinForm: el("mpJoinForm"), mpCode: el("mpCode"), mpSetupMsg: el("mpSetupMsg"),
  mpLobby: el("mpLobby"), mpLobbyCode: el("mpLobbyCode"), mpCopyCode: el("mpCopyCode"),
  mpPlayerCount: el("mpPlayerCount"), mpPlayerList: el("mpPlayerList"),
  mpStart: el("mpStart"), mpWait: el("mpWait"), mpLobbyLeave: el("mpLobbyLeave"),
  mpDiffWrap: el("mpDiffWrap"), mpDiffChoice: el("mpDiffChoice"),
  mpBoard: el("mpBoard"), mpBoardHead: el("mpBoardHead"), mpBoardList: el("mpBoardList"),
  mpResults: el("mpResults"), mpAnswer: el("mpAnswer"), mpStandings: el("mpStandings"),
  mpAgain: el("mpAgain"), mpBackLobby: el("mpBackLobby"), mpResultsLeave: el("mpResultsLeave"),
  // mascot
  mascot: el("mascot"), mascotBubble: el("mascotBubble"),
  // music
  musicBtn: el("musicBtn"), musicPanel: el("musicPanel"), musicToggle: el("musicToggle"),
  musicNow: el("musicNow"), musicVol: el("musicVol"), musicSelect: el("musicSelect"),
  // menu
  menu: el("menu"), modeChoice: el("modeChoice"), citiesProBadge: el("citiesProBadge"),
  countrySection: el("countrySection"), countryChoice: el("countryChoice"),
  diffChoice: el("diffChoice"), playBtn: el("playBtn"), menuCoffee: el("menuCoffee"), proStatus: el("proStatus"),
  // confirm leave
  confirmLeave: el("confirmLeave"), confirmStay: el("confirmStay"), confirmLeaveBtn: el("confirmLeaveBtn"),
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
  targetPool: [],
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
  online: false,
  mp: { socket: null, code: null, youId: null, hostId: null, players: [], phase: "lobby", asHost: false, mode: "easy" },
};
let mpDiff = "easy"; // host's chosen difficulty in the lobby
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
/* render a guess we already know the distance for (used by both modes).
 * brng = bearing to the target (easy mode), or null to hide direction. */
function applyGuess(country, km, brng = null) {
  const p = proximity(km);
  state.guessed.set(country.name, { country, km, proximity: p, brng });
  render();
  flyTo(country);
  addFeedItem(country, km, p, brng);
  updateClosest();
  if (!state.online) ui.feedPanel.hidden = false;
  ui.closestPanel.hidden = false;
  reactToGuess(p, km === 0);
}

function commitGuess(country) {
  if (state.solved || state.guessed.has(country.name)) {
    if (state.guessed.has(country.name)) flash(`You already guessed ${country.name}.`, "warn");
    return;
  }
  const km = country === state.target ? 0 : haversine(country, state.target);
  const brng = (state.mode === "easy" && km > 0 && state.target) ? bearing(country, state.target) : null;
  applyGuess(country, km, brng);
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
  if (state.online) { // host ends the round for everyone
    if (state.mp.hostId === state.mp.youId) state.mp.socket?.send(JSON.stringify({ type: "end" }));
    return;
  }
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
  globe.pointOfView({ lat: state.target.lat, lng: state.target.lng, altitude: camAlt(1.6) }, 900);
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
  const targets = state.targetPool.length ? state.targetPool : state.pool;
  state.target = state.daily && state.dailyTarget
    ? state.dailyTarget
    : targets[Math.floor(Math.random() * targets.length)];
  state.guessed.clear();
  state.solved = false;
  state.pendingSuggestion = null;
  state.hints = state.gameType === "cities" ? buildCityHints(state.target, state.pool) : buildHints(state.target);
  state.hintIndex = 0;
  ui.hintBtn.disabled = false;
  ui.forfeitBtn.disabled = false;
  ui.input.disabled = false;
  ui.hintBtn.textContent = "💡 Hint";
  ui.forfeitBtn.textContent = "🏳️ Give up";
  ui.hintBox.hidden = true;
  ui.feedList.innerHTML = "";
  ui.guessCount.textContent = "0";
  // on phones, start the feed collapsed so the globe stays visible
  ui.feedPanel.classList.toggle("collapsed", window.innerWidth <= 720);
  ui.feedPanel.hidden = true;
  ui.closestPanel.hidden = true;
  ui.suggest.hidden = true;
  ui.winOverlay.hidden = true;
  ui.hint.textContent = "";
  ui.input.value = "";
  ui.input.focus();
  ui.mascot.hidden = true;
  ui.mascotBubble.hidden = true;
  render();
  // frame the playing field
  if (state.gameType === "cities") {
    globe.pointOfView({ lat: state.target.lat, lng: state.target.lng, altitude: camAlt(1.4) }, 1200);
  } else {
    globe.pointOfView({ lat: 20, lng: 0, altitude: camAlt(2.5) }, 1200);
  }
  // dev aid: console.log("target:", state.target.name);
}

/* ---------------- menu / start ---------------- */
function showMenu() {
  // clear any in-progress board
  state.target = null;
  state.guessed.clear();
  state.solved = false;
  // tear down any multiplayer session
  state.online = false;
  if (state.mp.socket) { try { state.mp.socket.close(); } catch {} state.mp.socket = null; }
  closeMpOverlays();
  ui.mpBoard.hidden = true;
  ui.mascot.hidden = true;
  ui.mascotBubble.hidden = true;
  ui.input.disabled = false;
  ui.hintBtn.style.display = "";
  ui.forfeitBtn.style.display = "";
  ui.cardFriends.hidden = !MULTIPLAYER_ENABLED;
  ui.menuStep1.hidden = false;
  ui.menuStep2.hidden = true;
  if (globe) { render(); controls.autoRotate = true; controls.autoRotateSpeed = 1.6; globe.pointOfView({ altitude: 2.3 }, 1100); }
  ui.topBar.hidden = true;
  ui.inputBar.hidden = true;
  ui.closestPanel.hidden = true;
  ui.feedPanel.hidden = true;
  ui.winOverlay.hidden = true;
  ui.confirmLeave.hidden = true;
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
  state.online = false;
  if (menuSel.mode === "cities") {
    if (!isPro()) { openUnlock(); return; }
    if (!menuSel.country) { pulse(ui.countrySection); return; }
    const set = state.sets["city:" + menuSel.country];
    state.gameType = "cities";
    state.cityCountry = menuSel.country;
    state.pool = set.pool;           // every real city = a valid guess
    state.targetPool = set.targets;  // but the answer is a well-known city
    state.byNorm = set.byNorm;
    state.maxRef = MAX_REF_KM_CITY;
    ui.input.placeholder = `Type a city in ${menuSel.country} and press Enter…`;
  } else {
    state.gameType = "countries";
    state.cityCountry = null;
    state.pool = state.sets.countries.pool;
    state.targetPool = state.sets.countries.pool;
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
  state.online = false;
  state.dailyTarget = country;
  state.dailyNumber = number;
  state.gameType = "countries";
  state.cityCountry = null;
  state.pool = state.sets.countries.pool;
  state.targetPool = state.sets.countries.pool;
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
  let txt = `🌍 Guesstate Daily #${state.dailyNumber}\n${line}\n${squares}`;
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
      if (state.solved && state.target && name === state.target.name) return 0.03;
      return state.guessed.has(name) ? 0.02 : 0.008;
    })
    .polygonStrokeColor((f) =>
      state.guessed.has(effName(f)) ? "rgba(255,255,255,0.55)" : "rgba(120,150,230,0.18)"
    );
}

function renderLabels() {
  // label every guessed place on the globe so you can see which highlighted
  // country/city is which. Cities use the heat colour; countries use white text
  // (readable over the coloured land).
  const cities = state.gameType === "cities";
  const labels = [...state.guessed.values()].map((g) => ({
    lat: g.country.lat, lng: g.country.lng, name: g.country.name,
    color: g.country === state.target ? "#7dffce" : (cities ? heatColor(g.proximity, 1) : "#ffffff"),
  }));
  // reveal the answer's label at the end (won/forfeit/round-over)
  if (state.solved && state.target && state.target.lat != null && !state.guessed.has(state.target.name)) {
    labels.push({ lat: state.target.lat, lng: state.target.lng, name: state.target.name, color: "#7dffce" });
  }
  globe.labelsData(labels);
}

function render() { paintGlobe(); renderLabels(); }

function flyTo(country, altitude) {
  const alt = camAlt(altitude ?? (state.gameType === "cities" ? 1.2 : 1.9));
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
  if (state.mode === "easy" && best.km > 0 && best.brng != null) {
    const b = best.brng;
    const arrow = `<span style="display:inline-block;transform:rotate(${b}deg);color:var(--accent-2)">↑</span>`;
    ui.closestDir.innerHTML = `${arrow} target is ${compass(b)} · ${Math.round(b)}°`;
  } else if (state.online) {
    ui.closestDir.textContent = state.mode === "hard" ? "direction hidden · hard mode" : "";
  } else {
    ui.closestDir.textContent = state.mode === "hard" ? "direction hidden · hard mode" : "";
  }
}

function addFeedItem(country, km, p, brng = null) {
  ui.guessCount.textContent = String(state.guessed.size);
  const li = document.createElement("li");
  li.className = "feed-item";
  const color = country === state.target ? "#2ee6a6" : heatColor(p, 1);
  const arrow = (brng == null) ? ""
    : `<span class="fi-arrow" title="target is ${compass(brng)} (${Math.round(brng)}°) from ${country.name}" style="transform:rotate(${brng}deg)">↑</span>`;
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
  if (res.type === "exact") { ui.input.value = ""; sendOrCommit(res.country); }
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
  const c = state.pendingSuggestion; state.pendingSuggestion = null; sendOrCommit(c);
});
ui.suggestNo.addEventListener("click", () => { ui.suggest.hidden = true; state.pendingSuggestion = null; ui.input.focus(); });

ui.hintBtn.addEventListener("click", revealHint);
ui.forfeitBtn.addEventListener("click", forfeit);
ui.winAgain.addEventListener("click", newGame);
ui.winMenu.addEventListener("click", showMenu);
// confirm before leaving a game that's in progress (or any multiplayer game)
ui.menuBtn.addEventListener("click", () => {
  if (state.online || (!state.solved && state.guessed.size > 0)) ui.confirmLeave.hidden = false;
  else showMenu();
});
ui.confirmStay.addEventListener("click", () => { ui.confirmLeave.hidden = true; });
ui.confirmLeave.addEventListener("click", (e) => { if (e.target === ui.confirmLeave) ui.confirmLeave.hidden = true; });
ui.confirmLeaveBtn.addEventListener("click", () => { ui.confirmLeave.hidden = true; state.online ? leaveMp() : showMenu(); });

// two-step menu cards
ui.cardDaily.addEventListener("click", startDaily);
ui.cardFriends.addEventListener("click", openMpSetup);
ui.cardFree.addEventListener("click", () => { ui.menuStep1.hidden = true; ui.menuStep2.hidden = false; });
ui.menuBack.addEventListener("click", () => { ui.menuStep2.hidden = true; ui.menuStep1.hidden = false; });

// multiplayer
ui.mpSetupClose.addEventListener("click", () => { closeMpOverlays(); showMenu(); });
ui.mpCreate.addEventListener("click", createLobby);
ui.mpJoinForm.addEventListener("submit", (e) => { e.preventDefault(); joinLobby(ui.mpCode.value); });
ui.mpCopyCode.addEventListener("click", () => {
  navigator.clipboard?.writeText(state.mp.code);
  ui.mpCopyCode.textContent = "✓ Copied!";
  setTimeout(() => (ui.mpCopyCode.textContent = "📋 Copy code"), 1500);
});
ui.mpStart.addEventListener("click", () => state.mp.socket?.send(JSON.stringify({ type: "start", mode: mpDiff })));
ui.mpDiffChoice.addEventListener("click", (e) => {
  const btn = e.target.closest(".choice"); if (!btn) return;
  mpDiff = btn.dataset.diff;
  [...ui.mpDiffChoice.children].forEach((b) => b.classList.toggle("is-active", b === btn));
});
ui.mpLobbyLeave.addEventListener("click", leaveMp);
ui.mpBoardHead.addEventListener("click", () => ui.mpBoard.classList.toggle("collapsed"));
ui.mpBackLobby.addEventListener("click", () => state.mp.socket?.send(JSON.stringify({ type: "again" })));
ui.mpResultsLeave.addEventListener("click", leaveMp);
ui.winShare.addEventListener("click", shareResult);
ui.feedHead.addEventListener("click", () => ui.feedPanel.classList.toggle("collapsed"));

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
/* sprite from an SVG/image url (used for the cat & squirrel astronauts) */
function makeImageSprite(url) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const tex = new CanvasTexture(c);
  const img = new Image();
  img.onload = () => {
    const ctx = c.getContext("2d");
    const ar = img.width / img.height; let w = 256, h = 256;
    if (ar > 1) h = 256 / ar; else w = 256 * ar;
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
    tex.needsUpdate = true;
  };
  img.src = url;
  const mat = new SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false });
  return new Sprite(mat);
}

/* comical critters + space objects that slowly orbit the globe */
function addOrbiters() {
  const scene = globe.scene();
  const group = new Group();
  group.rotation.x = 0.4;
  orbiterSprites.cat = makeImageSprite("/cat-astronaut.svg");
  orbiterSprites.squirrel = makeImageSprite("/squirrel-astronaut.svg");
  const items = [
    { sp: orbiterSprites.cat, s: 12 },
    { sp: orbiterSprites.squirrel, s: 12.5 },
    { sp: makeEmojiSprite("🚀"), s: 11 },
    { sp: makeEmojiSprite("🛸"), s: 11 },
    { sp: makeEmojiSprite("🪐"), s: 12 },
    { sp: makeEmojiSprite("🛰️"), s: 10 },
  ];
  const R = 130;
  items.forEach(({ sp, s }, i) => {
    const phi = Math.acos(1 - 2 * (i + 0.5) / items.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    sp.position.set(R * Math.sin(phi) * Math.cos(theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
    sp.scale.set(s, s, 1);
    group.add(sp);
  });
  scene.add(group);
  const tick = () => { group.rotation.y += 0.0011; updateSpeechPosition(); requestAnimationFrame(tick); };
  tick();
}

/* ---------------- multiplayer ---------------- */
function sendOrCommit(country) { state.online ? sendGuess(country) : commitGuess(country); }

function sendGuess(country) {
  if (state.solved) return;
  if (state.guessed.has(country.name)) { flash(`You already guessed ${country.name}.`, "warn"); return; }
  state.mp.socket?.send(JSON.stringify({ type: "guess", name: country.name }));
}

const randCode = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
const mpMsg = (t, cls) => { ui.mpSetupMsg.textContent = t; ui.mpSetupMsg.className = "unlock-msg " + (cls || ""); };

function myName() {
  const n = (ui.mpName.value || "").trim().slice(0, 18) || "Player";
  localStorage.setItem("guesstate_name", n);
  return n;
}
function openMpSetup() {
  mpMsg("");
  if (!ui.mpName.value) ui.mpName.value = localStorage.getItem("guesstate_name") || "";
  ui.mpSetup.hidden = false;
  ui.mpName.focus();
}
function closeMpOverlays() { ui.mpSetup.hidden = true; ui.mpLobby.hidden = true; ui.mpResults.hidden = true; }

function connectLobby(code, asHost) {
  state.online = true;
  state.mp.code = code;
  state.mp.asHost = asHost;
  const sock = new PartySocket({ host: PARTY_HOST, room: code });
  state.mp.socket = sock;
  sock.addEventListener("message", (e) => { try { handleMpMessage(JSON.parse(e.data)); } catch {} });
  sock.addEventListener("open", () => sock.send(JSON.stringify({ type: "join", name: myName() })));
  sock.addEventListener("error", () => mpMsg("Couldn't connect to the lobby server. Try again.", "err"));
}
function createLobby() { connectLobby(randCode(), true); }
function joinLobby(raw) {
  const code = (raw || "").trim().toUpperCase();
  if (code.length < 3) return mpMsg("Enter a valid lobby code.", "err");
  connectLobby(code, false);
}

function handleMpMessage(m) {
  if (m.type === "welcome") { state.mp.youId = m.id; return; }
  if (m.type === "error") { mpMsg(m.message, "err"); return; }
  if (m.type === "guessResult") {
    const country = state.byNorm.get(norm(m.name));
    if (country) applyGuess(country, m.km, m.bearing ?? null);
    if (m.solved) { state.solved = true; ui.input.disabled = true; flash("You solved it! Waiting for others…", "ok"); }
    return;
  }
  if (m.type === "state") {
    state.mp.players = m.players;
    state.mp.hostId = m.hostId;
    state.mp.mode = m.mode || "hard";
    const prev = state.mp.phase;
    state.mp.phase = m.phase;
    if (m.phase === "lobby") enterLobbyView();
    else if (m.phase === "playing") { if (prev !== "playing") enterMpPlay(); renderBoard(); }
    else if (m.phase === "ended") showMpResults(m);
    return;
  }
}

function enterLobbyView() {
  closeMpOverlays();
  ui.menu.hidden = true;
  ui.topBar.hidden = true; ui.inputBar.hidden = true;
  ui.closestPanel.hidden = true; ui.feedPanel.hidden = true; ui.mpBoard.hidden = true;
  if (controls) { controls.autoRotate = true; globe.pointOfView({ altitude: 2.5 }, 800); }
  ui.mpLobby.hidden = false;
  ui.mpLobbyCode.textContent = state.mp.code;
  renderLobbyPlayers();
}
function renderLobbyPlayers() {
  const isHost = state.mp.hostId === state.mp.youId;
  ui.mpPlayerCount.textContent = String(state.mp.players.length);
  ui.mpPlayerList.innerHTML = state.mp.players.map((p) =>
    `<li>${esc(p.name)}${p.id === state.mp.youId ? ' <span class="mp-you">(you)</span>' : ""}${p.id === state.mp.hostId ? '<span class="host-tag">HOST</span>' : ""}</li>`
  ).join("");
  ui.mpStart.hidden = !isHost;
  ui.mpDiffWrap.hidden = !isHost;
  ui.mpWait.hidden = isHost;
  const enough = state.mp.players.length >= 2;
  ui.mpStart.disabled = !enough;
  ui.mpStart.textContent = enough ? "▶ START" : "Waiting for players…";
}

function enterMpPlay() {
  closeMpOverlays();
  state.gameType = "countries";
  state.online = true;
  state.cityCountry = null;
  state.pool = state.sets.countries.pool;
  state.byNorm = state.sets.countries.byNorm;
  state.maxRef = MAX_REF_KM;
  state.mode = state.mp.mode === "easy" ? "easy" : "hard";
  document.body.classList.toggle("is-hard", state.mode === "hard");
  state.target = null;
  state.solved = false;
  state.guessed.clear();
  ui.feedList.innerHTML = "";
  ui.input.disabled = false;
  ui.input.value = "";
  ui.input.placeholder = "Type a country and press Enter…";
  ui.gameReadout.textContent = `👥 Lobby ${state.mp.code}`;
  ui.hint.textContent = "";
  ui.feedPanel.hidden = true;
  ui.closestPanel.hidden = true;
  ui.hintBtn.style.display = "none";
  const isHost = state.mp.hostId === state.mp.youId;
  ui.forfeitBtn.style.display = isHost ? "" : "none";
  ui.forfeitBtn.textContent = "🏁 End round";
  ui.forfeitBtn.disabled = false;
  ui.topBar.hidden = false;
  ui.inputBar.hidden = false;
  ui.mpBoard.hidden = false;
  ui.mpBoard.classList.remove("collapsed");
  ui.mascot.hidden = true;
  ui.mascotBubble.hidden = true;
  if (controls) controls.autoRotate = false;
  render();
  globe.pointOfView({ lat: 20, lng: 0, altitude: camAlt(2.5) }, 1000);
  ui.input.focus();
}

function cmpPlayers(a, b) {
  if (a.solved && b.solved) return a.solvedTries - b.solvedTries;
  if (a.solved) return -1;
  if (b.solved) return 1;
  return (a.closestKm ?? Infinity) - (b.closestKm ?? Infinity);
}
function renderBoard() {
  const players = [...state.mp.players].sort(cmpPlayers);
  ui.mpBoardList.innerHTML = players.map((p, i) => {
    const stat = p.solved ? `✓ ${p.solvedTries}` : (p.closestKm != null ? `${Math.round(p.closestKm).toLocaleString()}km` : "—");
    return `<li class="board-row ${p.id === state.mp.youId ? "is-you" : ""} ${p.solved ? "solved" : ""}">
      <span class="board-rank">${i + 1}</span>
      <span class="board-name">${esc(p.name)}</span>
      <span class="board-stat">${stat}</span></li>`;
  }).join("");
}

function showMpResults(m) {
  state.solved = true;
  if (m.target) { state.target = state.byNorm.get(norm(m.target)) || { name: m.target }; render(); }
  ui.input.disabled = true;
  ui.mpBoard.hidden = true;
  ui.inputBar.hidden = true;
  ui.mpAnswer.textContent = m.target || "—";
  const players = [...state.mp.players].sort(cmpPlayers);
  ui.mpStandings.innerHTML = players.map((p, i) => {
    const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
    const stat = p.solved ? `solved in ${p.solvedTries}` : (p.closestKm != null ? `closest ${Math.round(p.closestKm).toLocaleString()} km` : "no guesses");
    return `<li><span class="board-rank">${medal}</span><span class="board-name">${esc(p.name)}${p.id === state.mp.youId ? " (you)" : ""}</span><span class="board-stat">${stat}</span></li>`;
  }).join("");
  ui.mpBackLobby.hidden = state.mp.hostId !== state.mp.youId;
  ui.mpAgain.hidden = true;
  ui.mpResults.hidden = false;
}

function leaveMp() {
  try { state.mp.socket?.close(); } catch {}
  state.mp.socket = null;
  state.online = false;
  closeMpOverlays();
  ui.mpBoard.hidden = true;
  ui.input.disabled = false;
  ui.hintBtn.style.display = "";
  ui.forfeitBtn.style.display = "";
  showMenu();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- mascot (hardcoded comical reactions) ---------------- */
const MASCOT = {
  cat: "/cat-astronaut.svg",
  squirrel: "/squirrel-astronaut.svg",
};
const LINES = {
  far: [
    ["squirrel", "That's nuts. And not the good kind. 🥜"],
    ["cat", "Colder than the dev's third coffee. ☕"],
    ["squirrel", "Bold guess. Confidently incorrect."],
    ["cat", "I'm a cat in a fishbowl and even I know that's wrong."],
    ["squirrel", "Map? Or magic 8-ball?"],
    ["cat", "The globe felt that. It's offended now."],
  ],
  mid: [
    ["cat", "Warmer. Don't let it go to your head."],
    ["squirrel", "Ooh, a flicker of competence! ✨"],
    ["cat", "Getting toasty. Like my nap spot."],
    ["squirrel", "The hardcoded 'warmer' line approves."],
  ],
  close: [
    ["squirrel", "SO close my tail's doing the thing! 🐿️"],
    ["cat", "Hot! The globe is basically blushing."],
    ["squirrel", "Practically there. Don't lick the screen."],
    ["cat", "One pixel left and it's yours."],
  ],
  solved: [
    ["squirrel", "FINALLY. I was running out of material. 🎉"],
    ["cat", "GG. I'll notify the other 8 pixels of me."],
    ["squirrel", "Nailed it! Tell everyone I helped. (I didn't.)"],
    ["cat", "Correct. I'm contractually obligated to be impressed."],
  ],
  idle: [
    ["cat", "I orbit all day so you can sit there. You're welcome."],
    ["squirrel", "Fun fact: I'm a PNG having an existential crisis."],
    ["cat", "These rockets keep photobombing my orbit. 🚀"],
    ["squirrel", "Is it nap o'clock? It's always nap o'clock."],
    ["cat", "Psst. The answer's a country. Narrowed it down for ya."],
    ["squirrel", "I've seen every guess. I have notes."],
  ],
};
/* The cat & squirrel orbit the globe (see addOrbiters). When they have something
 * to say, a speech bubble follows whichever one is talking around the globe. */
const orbiterSprites = {};   // { cat: Sprite, squirrel: Sprite }
let mascotTimer, mascotIdleAt = 0, speechSpeaker = null;
const _projV = new Vector3();
function sayMascot(text, who) {
  if (ui.inputBar.hidden && ui.menu.hidden) return; // only on the menu or during play
  ui.mascotBubble.textContent = text;
  speechSpeaker = orbiterSprites[who] || orbiterSprites.cat || null;
  ui.mascot.hidden = false;
  updateSpeechPosition();
  mascotIdleAt = Date.now();
  clearTimeout(mascotTimer);
  mascotTimer = setTimeout(() => { ui.mascot.hidden = true; speechSpeaker = null; }, 5000);
}
function updateSpeechPosition() {
  if (ui.mascot.hidden || !speechSpeaker || !globe) return;
  const cam = globe.camera();
  if (!cam) return;
  speechSpeaker.getWorldPosition(_projV).project(cam);
  let x = (_projV.x * 0.5 + 0.5) * window.innerWidth;
  let y = (-_projV.y * 0.5 + 0.5) * window.innerHeight;
  if (!isFinite(x)) x = window.innerWidth / 2;
  if (!isFinite(y)) y = window.innerHeight / 2;
  if (_projV.z > 1) x = window.innerWidth - x; // behind camera: mirror so it stays sensible
  // keep the bubble on-screen, clear of the top panels and the input bar
  x = Math.max(80, Math.min(window.innerWidth - 80, x));
  y = Math.max(220, Math.min(window.innerHeight - 180, y));
  ui.mascot.style.left = x + "px";
  ui.mascot.style.top = y + "px";
}
function sayFrom(bucket) {
  const arr = LINES[bucket]; const [who, text] = arr[Math.floor(Math.random() * arr.length)];
  sayMascot(text, who);
}
function reactToGuess(p, solved) {
  if (solved) return sayFrom("solved");
  if (p < 0.34) sayFrom("far");
  else if (p < 0.7) sayFrom("mid");
  else sayFrom("close");
}
setInterval(() => {
  const active = !ui.inputBar.hidden || !ui.menu.hidden;
  if (active && Date.now() - mascotIdleAt > 14000) sayFrom("idle");
}, 5000);

/* ---------------- ambient soundscape (generated in-browser) ----------------
 * HALAL by design: NO musical instruments, melodies, or chords — only natural
 * ambience (rain, ocean, wind) synthesised from filtered noise. Not "music",
 * just background sound. Copyright-free (we generate it). */
const ambient = {
  ctx: null, master: null, playing: false, mood: 0, sources: [], lfos: [], dropTimer: null,
  moods: ["Rain ☔", "Ocean 🌊", "Night wind 🌌"],
  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
  },
  noise(sec = 3) { // smoothed (brownish) noise buffer, looping
    const len = this.ctx.sampleRate * sec, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s;
  },
  lfo(rate, depth, target) {
    const o = this.ctx.createOscillator(); o.frequency.value = rate;
    const g = this.ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(target); o.start(); this.lfos.push(o);
  },
  build() {
    this.teardown();
    const ctx = this.ctx, out = this.master;
    const src = this.noise(); this.sources.push(src);
    if (this.mood === 0) {                 // Rain
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 8500;
      const g = ctx.createGain(); g.gain.value = 0.55;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); src.start();
      this.dropTimer = setInterval(() => {  // occasional droplets
        if (!this.playing) return;
        const b = this.noise(0.06), f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2200 + Math.random() * 4500; f.Q.value = 3;
        const dg = ctx.createGain(), t = ctx.currentTime;
        dg.gain.setValueAtTime(0, t); dg.gain.linearRampToValueAtTime(0.12, t + 0.004); dg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        b.connect(f); f.connect(dg); dg.connect(out); b.start(t); b.stop(t + 0.12);
      }, 85);
    } else if (this.mood === 1) {          // Ocean
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
      const g = ctx.createGain(); g.gain.value = 0.42;
      src.connect(lp); lp.connect(g); g.connect(out); src.start();
      this.lfo(0.08, 0.26, g.gain);        // wave swell (volume)
      this.lfo(0.08, 380, lp.frequency);   // wave swell (brightness)
    } else {                               // Night wind
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 480;
      const g = ctx.createGain(); g.gain.value = 0.34;
      src.connect(lp); lp.connect(g); g.connect(out); src.start();
      this.lfo(0.05, 300, lp.frequency);
      this.lfo(0.03, 0.12, g.gain);
    }
  },
  teardown() {
    clearInterval(this.dropTimer);
    this.sources.forEach((s) => { try { s.stop(); } catch {} });
    this.lfos.forEach((l) => { try { l.stop(); } catch {} });
    this.sources = []; this.lfos = [];
  },
  start() {
    if (!this.ctx) this.init();
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.playing) return;
    this.playing = true; this.build();
  },
  stop() { this.playing = false; this.teardown(); },
  setVol(v) { if (this.master) this.master.gain.value = v; },
  setMood(i) { this.mood = i; if (this.playing) this.build(); },
};

function initMusic() {
  ui.musicBtn.hidden = false; // generated ambience is always available, no files needed
  ui.musicSelect.innerHTML = ambient.moods.map((m, i) => `<option value="${i}">${esc(m)}</option>`).join("");
  const vol = parseFloat(localStorage.getItem("guesstate_music_vol"));
  const v = isNaN(vol) ? 0.5 : vol;
  ui.musicVol.value = v; ambient.setVol(v);
  const mood = Math.min(ambient.moods.length - 1, parseInt(localStorage.getItem("guesstate_music_mood") || "0", 10));
  ambient.setMood(mood); ui.musicSelect.value = String(mood); ui.musicNow.textContent = ambient.moods[mood];

  ui.musicBtn.addEventListener("click", () => { ui.musicPanel.hidden = !ui.musicPanel.hidden; });
  ui.musicToggle.addEventListener("click", () => {
    if (ambient.playing) { ambient.stop(); ui.musicToggle.textContent = "▶"; }
    else { ambient.setVol(+ui.musicVol.value); ambient.start(); ui.musicToggle.textContent = "⏸"; }
  });
  ui.musicVol.addEventListener("input", () => { ambient.setVol(+ui.musicVol.value); localStorage.setItem("guesstate_music_vol", ui.musicVol.value); });
  ui.musicSelect.addEventListener("change", () => {
    ambient.setMood(+ui.musicSelect.value); ui.musicNow.textContent = ambient.moods[+ui.musicSelect.value];
    localStorage.setItem("guesstate_music_mood", ui.musicSelect.value);
  });
}

/* ---------------- boot ---------------- */
const CITY_TARGET_MIN_POP = 250000; // answers come from "well-known" cities only
const CITY_TARGET_MIN_COUNT = 15;   // ...but ensure at least this many per country

/* Build a country's city set from the GeoNames-derived list.
 * pool = every real city (valid guesses); targets = the famous subset (answers). */
function buildCitySet(country, list) {
  const pool = list.map((c) => ({ name: c.name, country, lat: c.lat, lng: c.lng }));
  const byNorm = new Map();
  for (const c of pool) byNorm.set(norm(c.name), c);
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    const c = byNorm.get(norm(canonical));
    if (c) byNorm.set(norm(alias), c);
  }
  // famous subset for the answer (list is sorted by population desc)
  let famous = list.filter((c) => c.pop >= CITY_TARGET_MIN_POP);
  if (famous.length < CITY_TARGET_MIN_COUNT) famous = list.slice(0, CITY_TARGET_MIN_COUNT);
  const famousKeys = new Set(famous.map((c) => norm(c.name)));
  const targets = pool.filter((c) => famousKeys.has(norm(c.name)));
  return { pool, byNorm, targets };
}

async function boot() {
  ui.coffeeBtn.href = KOFI_URL;
  ui.menuCoffee.href = KOFI_URL;
  ui.winSupport.href = KOFI_URL;
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
    // also accept the short common name (e.g. "Tanzania" -> "United Republic of
    // Tanzania", "Czechia", "Bolivia"...) so formal ADMIN names aren't a barrier
    for (const alt of [f.properties.NAME, f.properties.NAME_LONG, f.properties.GEOUNIT]) {
      if (alt && norm(alt) && !state.sets.countries.byNorm.has(norm(alt))) {
        state.sets.countries.byNorm.set(norm(alt), country);
      }
    }
  }
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    const c = state.sets.countries.byNorm.get(norm(canonical));
    if (c) state.sets.countries.byNorm.set(norm(alias), c);
  }

  // per-country city sets from the real city database (public/cities.json)
  const citiesData = await (await fetch("/cities.json")).json();
  state.cityCountries = Object.keys(citiesData);
  for (const country of state.cityCountries) {
    state.sets["city:" + country] = buildCitySet(country, citiesData[country]);
  }

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
    // place labels on the globe
    .labelLat((d) => d.lat).labelLng((d) => d.lng).labelText((d) => d.name)
    .labelColor((d) => d.color).labelDotRadius(0.3).labelSize(1.9)
    .labelResolution(3).labelAltitude(0.04).labelsTransitionDuration(250)
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
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));
  window.addEventListener("load", resize);
  // mobile: URL-bar show/hide and keyboard open/close fire here, not always "resize"
  window.visualViewport?.addEventListener("resize", resize);
  resize();
  // re-fit after first layout settles (fixes dead-space on high-DPI phones)
  requestAnimationFrame(resize);
  setTimeout(resize, 250);
  setTimeout(resize, 800);

  // iOS Safari: the on-screen keyboard covers fixed-bottom elements. Lift the
  // input bar above the keyboard using the visual viewport so it stays visible.
  const vv = window.visualViewport;
  if (vv) {
    const positionInput = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      ui.inputBar.style.transform = inset > 1 ? `translateY(${-inset}px)` : "";
    };
    vv.addEventListener("resize", positionInput);
    vv.addEventListener("scroll", positionInput);
  }

  setInterval(() => globe.arcsData(makeDecoArcs(20)), 10000);

  initMusic();
  showMenu();
  ui.loading.classList.add("is-hidden");
  setTimeout(() => (ui.loading.hidden = true), 700);
}

boot().catch((err) => {
  console.error(err);
  ui.loading.innerHTML = `<span style="color:#ff5a4d">Failed to load: ${err.message}</span>`;
});
