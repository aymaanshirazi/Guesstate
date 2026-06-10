/* Guesstate multiplayer server (PartyKit).
 * One room = one lobby (room id = lobby code).
 *
 * AUTHORITATIVE: the server holds the secret target and validates every guess,
 * so players can't cheat by reading the answer. It broadcasts only each player's
 * closest distance, try count, and solved status — never the country they typed.
 */
import COUNTRIES from "./countries.json";

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const BY_NORM = new Map(COUNTRIES.map((c) => [norm(c.name), c]));

function haversine(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const MAX_PLAYERS = 10;

export default class GuesstateServer {
  constructor(room) {
    this.room = room;
    this.players = new Map(); // id -> player
    this.phase = "lobby";     // lobby | playing | ended
    this.target = null;       // secret {name,lat,lng}
    this.hostId = null;
    this.round = 0;
    this.solveCount = 0;
    this.roundMode = "hard"; // "easy" shows direction, "hard" hides it
  }

  onConnect(conn) {
    if (this.players.size >= MAX_PLAYERS) {
      conn.send(JSON.stringify({ type: "error", message: "Lobby is full" }));
      conn.close();
      return;
    }
    if (!this.hostId) this.hostId = conn.id;
    this.players.set(conn.id, this.blankPlayer(conn.id));
    conn.send(JSON.stringify({ type: "welcome", id: conn.id }));
    this.broadcastState();
  }

  onClose(conn) {
    this.players.delete(conn.id);
    if (this.hostId === conn.id) this.hostId = this.players.keys().next().value || null;
    this.broadcastState();
  }

  onMessage(raw, sender) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = this.players.get(sender.id);
    if (!p) return;

    switch (msg.type) {
      case "join":
        p.name = (String(msg.name || "").trim().slice(0, 18)) || "Player";
        this.broadcastState();
        break;
      case "start":
        if (sender.id === this.hostId && this.players.size >= 1) {
          this.roundMode = msg.mode === "easy" ? "easy" : "hard";
          this.startRound();
        }
        break;
      case "guess":
        if (this.phase === "playing" && !p.solved) this.handleGuess(p, msg.name, sender);
        break;
      case "end": // host reveals / ends the round early
        if (sender.id === this.hostId && this.phase === "playing") {
          this.phase = "ended";
          this.broadcastState();
        }
        break;
      case "again": // host returns everyone to the lobby
        if (sender.id === this.hostId) {
          this.phase = "lobby";
          this.target = null;
          for (const pl of this.players.values()) this.resetPlayer(pl);
          this.broadcastState();
        }
        break;
    }
  }

  startRound() {
    this.target = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    this.phase = "playing";
    this.round++;
    this.solveCount = 0;
    for (const pl of this.players.values()) this.resetPlayer(pl);
    this.broadcastState();
  }

  handleGuess(p, name, sender) {
    const c = BY_NORM.get(norm(String(name || "")));
    if (!c) return; // client pre-resolves names; ignore anything unknown
    p.tries++;
    const solvedNow = c.name === this.target.name;
    const km = solvedNow ? 0 : haversine(c, this.target);
    if (p.closestKm === null || km < p.closestKm) p.closestKm = km;
    if (solvedNow) {
      p.solved = true;
      p.solvedTries = p.tries;
      p.solvedRank = ++this.solveCount;
    }
    // private feedback to the guesser only (distance, + bearing in easy mode) so
    // they can colour the globe + see how close they are. Never sent to others.
    const brng = this.roundMode === "easy" && !solvedNow ? Math.round(bearing(c, this.target)) : null;
    sender.send(JSON.stringify({ type: "guessResult", name: c.name, km, solved: solvedNow, bearing: brng }));
    if ([...this.players.values()].every((pl) => pl.solved)) this.phase = "ended";
    this.broadcastState();
  }

  broadcastState() {
    const players = [...this.players.values()].map((pl) => ({
      id: pl.id, name: pl.name, tries: pl.tries, closestKm: pl.closestKm,
      solved: pl.solved, solvedTries: pl.solvedTries, solvedRank: pl.solvedRank,
    }));
    const state = {
      type: "state", phase: this.phase, hostId: this.hostId,
      code: this.room.id, round: this.round, mode: this.roundMode, players,
    };
    if (this.phase === "ended" && this.target) state.target = this.target.name; // reveal only at the end
    this.room.broadcast(JSON.stringify(state));
  }

  blankPlayer(id) { return { id, name: "Player", tries: 0, closestKm: null, solved: false, solvedTries: null, solvedRank: null }; }
  resetPlayer(pl) { pl.tries = 0; pl.closestKm = null; pl.solved = false; pl.solvedTries = null; pl.solvedRank = null; }
}
