/* Generate party/countries.json: a list of {name, lat, lng} country centroids
 * for the multiplayer server (which must hold the secret target + validate
 * guesses server-side). Mirrors the client's rules: skip Antarctica; Israel is
 * merged into Palestine (not a separate guess/target). */
import fs from "fs";
import { geoCentroid } from "d3-geo";

const geo = JSON.parse(fs.readFileSync("public/countries.geojson", "utf8"));
const MERGE_INTO = { Israel: "Palestine" };

const out = [];
const seen = new Set();
for (const f of geo.features) {
  const name = f.properties.ADMIN || f.properties.NAME;
  if (!name || name === "Antarctica" || MERGE_INTO[name]) continue;
  const [lng, lat] = geoCentroid(f);
  if (!isFinite(lat) || !isFinite(lng) || seen.has(name)) continue;
  seen.add(name);
  out.push({ name, lat: +lat.toFixed(3), lng: +lng.toFixed(3) });
}

fs.mkdirSync("party", { recursive: true });
fs.writeFileSync("party/countries.json", JSON.stringify(out));
console.log(`wrote party/countries.json: ${out.length} countries`);
