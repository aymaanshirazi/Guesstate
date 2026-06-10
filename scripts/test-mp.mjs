/* Local test of the multiplayer server: 2 players, race to guess. */
import { PartySocket } from "partysocket";
import fs from "fs";

const HOST = process.argv[2] || "127.0.0.1:1999";
const ROOM = "TESTROOM" + Math.floor(Math.random() * 9999);
const names = JSON.parse(fs.readFileSync("party/countries.json", "utf8")).map((c) => c.name);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function mk() {
  const s = new PartySocket({ host: HOST, room: ROOM });
  s.lastState = null; s.myId = null;
  s.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "welcome") s.myId = m.id;
    if (m.type === "state") s.lastState = m;
  });
  return s;
}
const me = (s) => s.lastState?.players.find((p) => p.id === s.myId);

const alice = mk(), bob = mk();
await wait(1000);
alice.send(JSON.stringify({ type: "join", name: "Alice" }));
bob.send(JSON.stringify({ type: "join", name: "Bob" }));
await wait(300);
console.log("players in lobby:", alice.lastState.players.map((p) => p.name).join(", "), "| host:", alice.lastState.hostId === alice.myId ? "Alice" : "Bob");

alice.send(JSON.stringify({ type: "start" }));
await wait(300);
console.log("phase after start:", alice.lastState.phase, "| target leaked to client?", alice.lastState.target ?? "NO (good)");

// Bob makes 3 guesses (won't necessarily solve)
for (const g of ["Brazil", "Egypt", "Japan"]) { bob.send(JSON.stringify({ type: "guess", name: g })); await wait(40); }
// Alice brute-forces until solved
for (const g of names) {
  if (me(alice)?.solved) break;
  alice.send(JSON.stringify({ type: "guess", name: g }));
  await wait(15);
}
await wait(300);
console.log("Alice solved:", me(alice)?.solved, "in", me(alice)?.solvedTries, "tries | Bob closestKm:", Math.round(me(bob)?.closestKm ?? -1));

// host ends the round to reveal
alice.send(JSON.stringify({ type: "end" }));
await wait(300);
console.log("phase:", alice.lastState.phase, "| TARGET revealed:", alice.lastState.target);
console.log("LEADERBOARD:");
for (const p of alice.lastState.players) {
  console.log(`  ${p.name}: tries=${p.tries} closest=${p.closestKm ? Math.round(p.closestKm) + "km" : "-"} solved=${p.solved} rank=${p.solvedRank ?? "-"}`);
}
process.exit(0);
