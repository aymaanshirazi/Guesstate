/* Generate public/cities.json from a GeoNames cities15000.txt dump.
 * Usage: node scripts/gen-cities.mjs <path-to-cities15000.txt>
 * Output grouped by our country labels, sorted by population desc. */
import fs from "fs";

const input = process.argv[2];
const txt = fs.readFileSync(input, "utf8");

const MAP = { US: "USA", CA: "Canada", GB: "UK", ES: "Spain", FR: "France", DE: "Germany" };
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const byCountry = {};
for (const k of Object.values(MAP)) byCountry[k] = new Map(); // normName -> {name,lat,lng,pop}

for (const line of txt.split("\n")) {
  if (!line) continue;
  const c = line.split("\t");
  const label = MAP[c[8]];
  if (!label) continue;
  const name = c[1];
  const lat = parseFloat(c[4]), lng = parseFloat(c[5]);
  const pop = parseInt(c[14] || "0", 10);
  if (!name || !isFinite(lat) || !isFinite(lng)) continue;
  const key = norm(name);
  if (!key) continue;
  const prev = byCountry[label].get(key);
  if (!prev || pop > prev.pop) byCountry[label].set(key, { name, lat: +lat.toFixed(3), lng: +lng.toFixed(3), pop });
}

const CAP = 1000;
const out = {};
for (const [label, m] of Object.entries(byCountry)) {
  out[label] = [...m.values()].sort((a, b) => b.pop - a.pop).slice(0, CAP);
}

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/cities.json", JSON.stringify(out));

// ---- stats / sanity ----
for (const [label, arr] of Object.entries(out)) {
  console.log(`${label}: ${arr.length} cities | top: ${arr.slice(0, 3).map((x) => x.name).join(", ")} | smallest pop: ${arr[arr.length - 1].pop}`);
}
const has = (label, n) => byCountry[label].has(norm(n));
console.log("checks -> Pickering:", has("Canada", "Pickering"), "| Ajax:", has("Canada", "Ajax"), "| Mississauga:", has("Canada", "Mississauga"));
console.log("NYC display name:", out.USA.find((x) => norm(x.name).includes("new york"))?.name);
console.log("LA display name:", out.USA.find((x) => x.name.includes("Los Angeles"))?.name);
console.log("file size KB:", (fs.statSync("public/cities.json").size / 1024).toFixed(0));
