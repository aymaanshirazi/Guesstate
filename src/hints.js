/* Progressive, funny-but-useful hints (no em dashes).
 * Ordered roughly vague -> specific so early clicks don't give it away,
 * but the middle clues are deliberately concrete so you don't have to spam. */

// Clean, funny, genuinely-pointing facts. Keyed by country ADMIN name.
const FUN_FACTS = {
  "United States of America": "Home of bald eagles, 50 states, and putting ranch on everything.",
  "Canada": "Maple syrup, ice hockey, and world-class apologizing.",
  "Mexico": "Tacos, ancient pyramids, and the actual birthplace of chocolate.",
  "Brazil": "Carnival, the Amazon, and football played like sorcery.",
  "Argentina": "Steak the size of your face, tango, and very emotional football.",
  "Chile": "A ribbon of a country: super long, super thin, squeezed by the Andes.",
  "Peru": "Llamas, ceviche, and a famous lost city high in the mountains.",
  "Colombia": "Coffee, emeralds, and two different oceans on its coasts.",
  "United Kingdom": "Tea, rain, and treating queuing as a competitive sport.",
  "Ireland": "Emerald-green fields, no snakes, and a very good stout.",
  "France": "Baguettes, berets, and a very famous metal tower.",
  "Spain": "Siestas, flamenco, and dinner starting at a casual 10pm.",
  "Portugal": "Custard tarts, surf, and explorers who mapped half the world.",
  "Germany": "Precision engineering, great sausages, and roads with no speed limit.",
  "Italy": "Shaped like a boot, invented pizza, talks with its hands.",
  "Netherlands": "Tulips, windmills, and officially more bikes than people.",
  "Belgium": "Waffles, chocolate, and roughly a thousand kinds of beer.",
  "Switzerland": "Chocolate, fancy watches, and aggressively neutral.",
  "Norway": "Fjords, the midnight sun, and seafaring Vikings.",
  "Sweden": "Flat-pack furniture, meatballs, and endless forests.",
  "Iceland": "Volcanoes, glaciers, and a phone book sorted by first name.",
  "Greece": "Invented democracy, gyros, and smashing plates for fun.",
  "Poland": "Pierogi, medieval old towns, and a LOT of history.",
  "Russia": "The biggest country on Earth, spanning 11 time zones.",
  "Turkey": "One foot in Europe, one in Asia, elite kebabs.",
  "Egypt": "Famous for some very large triangles in the desert.",
  "Morocco": "Mint tea, maze-like medinas, and the edge of the Sahara.",
  "Nigeria": "Afrobeats, Nollywood, and Africa's biggest population.",
  "Kenya": "Marathon legends and the original safari.",
  "South Africa": "Eleven official languages and penguins on the beach.",
  "Ethiopia": "The birthplace of coffee and a calendar of its very own.",
  "Saudi Arabia": "Home to the holiest city in Islam and endless golden desert.",
  "United Arab Emirates": "Built the tallest tower on Earth in the middle of a desert.",
  "Iran": "Ancient Persia: poetry, carpets, and breathtaking mosques.",
  "Iraq": "The land between two rivers, where writing was basically invented.",
  "India": "1.4 billion people, infinite spices, and the best chai going.",
  "Pakistan": "The world's second-highest mountain and frankly elite mangoes.",
  "China": "A wall so long it makes your morning walk look lazy.",
  "Japan": "Vending machines everywhere, bullet trains, world-class politeness.",
  "South Korea": "K-pop, kimchi, and the fastest internet you'll rage-quit on.",
  "Thailand": "Street food heaven, golden temples, the land of smiles.",
  "Vietnam": "Motorbikes everywhere, world-changing coffee, incredible pho.",
  "Indonesia": "An absurd number of islands. Roughly 17,000 of them.",
  "Australia": "Everything here can either kill you or catch a wave.",
  "New Zealand": "More sheep than people, and the backdrop for a famous trilogy.",
  "Afghanistan": "Rugged mountains, ancient trade routes, and the Hindu Kush.",
  "Bangladesh": "Crisscrossed by mighty rivers and the world's biggest delta.",
  "Kazakhstan": "Vast steppe, and the launchpad for actual space rockets.",
  "Cuba": "Vintage cars, cigars, and music on every corner.",
  "Jamaica": "Reggae, sprint champions, and very relaxing vibes.",
  "Mongolia": "Endless grassland, nomads, and Genghis Khan's old turf.",
};

const SUBREGION_LABEL = {
  "Seven seas (open ocean)": "a remote island out in the open ocean",
};
const subregionPhrase = (s) => SUBREGION_LABEL[s] || s;

export function buildHints(country) {
  const p = country.feature.properties;
  const hints = [];

  // 1) sub-region (concrete, but not a giveaway)
  if (p.SUBREGION) hints.push(`Look toward ${subregionPhrase(p.SUBREGION)}.`);
  else if (p.CONTINENT) hints.push(`It's somewhere in ${p.CONTINENT}.`);

  // 2) hemisphere + rough side of the map
  const ns = country.lat >= 0 ? "northern" : "southern";
  const ew = country.lng < 0 ? "western" : "eastern";
  hints.push(`It's in the ${ns} hemisphere, on the ${ew} side of the map.`);

  // 3) curated fact (a strong, fun pointer when we have one)
  if (FUN_FACTS[country.name]) hints.push(FUN_FACTS[country.name]);

  // 4) population, for a sense of scale
  const pop = p.POP_EST || 0;
  if (pop > 200e6) hints.push("Over 200 million people live here. That's a lot of group chats.");
  else if (pop > 50e6) hints.push("Tens of millions of people call it home.");
  else if (pop > 5e6) hints.push("A few million people live here. Cozy, by world standards.");
  else hints.push("Fewer people than some single cities. Easy to miss.");

  // 5) name length
  const letters = country.name.replace(/[^a-zA-Z]/g, "").length;
  hints.push(`The name has ${letters} letters, counting only the letters.`);

  // 6) first letter (last resort)
  hints.push(`Fine. It starts with the letter "${country.name[0].toUpperCase()}".`);

  return hints;
}

/* ---------------- cities ---------------- */
// Clean, funny facts for famous cities (keyed by city name).
const CITY_FACTS = {
  "New York": "The city so nice they named it twice. Allegedly never sleeps.",
  "Los Angeles": "Hollywood, traffic, and sunshine in roughly equal measure.",
  "Chicago": "Deep-dish pizza and a serious thing for tall buildings.",
  "Las Vegas": "A whole city built on the dream of beating the odds.",
  "San Francisco": "Famous fog, steep hills, and a very photogenic red bridge.",
  "Miami": "Beaches, pastel buildings, and aggressively good weather.",
  "Seattle": "Coffee, rain, and a very pointy tower from a World's Fair.",
  "Washington": "Monuments, museums, and the people who run the country.",
  "Toronto": "A very tall pointy tower, and extremely polite about it.",
  "Vancouver": "Mountains and ocean in the same view. The flex is real.",
  "Montreal": "Speaks French, makes great bagels, loves a festival.",
  "Quebec City": "Cobbled streets and a fortress that feels straight out of Europe.",
  "London": "Big clock, red buses, and a deep commitment to tea.",
  "Manchester": "Football and music. It gave the world a lot of bands.",
  "Liverpool": "The home port of four very famous lads with guitars.",
  "Edinburgh": "A castle on a hill and a very dramatic festival.",
  "Glasgow": "Shipyards, street art, and a famously sharp sense of humour.",
  "Cardiff": "A castle in the middle of town and a roaring rugby crowd.",
  "Belfast": "Built a certain very famous (and very ill-fated) ocean liner.",
  "Madrid": "Late dinners, grand plazas, and world-class art.",
  "Barcelona": "Wavy Gaudi architecture and a beach in the same city.",
  "Valencia": "The birthplace of paella, right on the coast.",
  "Seville": "Flamenco, orange trees, and heroic levels of summer heat.",
  "Bilbao": "A shimmering titanium museum that put it on the map.",
  "Granada": "A breathtaking hilltop palace from the days of Al-Andalus.",
  "Malaga": "Sun-soaked beaches and the birthplace of Picasso.",
  "Paris": "There's a famous metal tower here. You may have heard of it.",
  "Marseille": "France's gritty, sun-baked port on the Mediterranean.",
  "Lyon": "Widely called the food capital of France.",
  "Nice": "On the French Riviera, where the sea is impossibly blue.",
  "Bordeaux": "Surrounded by some of the most famous vineyards on Earth.",
  "Strasbourg": "Half French, half German, and home to a giant cathedral.",
  "Berlin": "Had a very famous wall. Now famous for nightlife and history.",
  "Munich": "Beer halls, pretzels, and a world-renowned autumn festival.",
  "Hamburg": "A massive port city with more bridges than Venice.",
  "Cologne": "Dominated by an enormous twin-spired Gothic cathedral.",
  "Frankfurt": "Germany's skyscraper-studded banking capital.",
};

/* `pool` is the set of cities for the chosen country, so we can give clues
 * relative to the country (which the player already picked). */
export function buildCityHints(city, pool = []) {
  const hints = [];

  if (pool.length > 2) {
    const lats = pool.map((c) => c.lat).sort((a, b) => a - b);
    const lngs = pool.map((c) => c.lng).sort((a, b) => a - b);
    const midLat = lats[Math.floor(lats.length / 2)];
    const midLng = lngs[Math.floor(lngs.length / 2)];
    const ns = city.lat > midLat + 1 ? "northern" : city.lat < midLat - 1 ? "southern" : "central";
    const ew = city.lng > midLng + 1 ? "eastern" : city.lng < midLng - 1 ? "western" : "central";
    if (ns === "central" && ew === "central") hints.push(`It sits roughly in the middle of ${city.country}.`);
    else if (ns === "central") hints.push(`Head to the ${ew} part of ${city.country}.`);
    else if (ew === "central") hints.push(`Head to the ${ns} part of ${city.country}.`);
    else hints.push(`It's in the ${ns}-${ew} part of ${city.country}.`);
  }

  // curated fact (strong pointer)
  if (CITY_FACTS[city.name]) hints.push(CITY_FACTS[city.name]);

  // a coastal-ish nudge based on how far it is from the country's average longitude edge
  // (kept simple and always-true-ish): syllable / length clue instead
  const letters = city.name.replace(/[^a-zA-Z]/g, "").length;
  hints.push(`The name has ${letters} letters, counting only the letters.`);

  // first letter (last resort)
  hints.push(`Okay, last clue: it starts with "${city.name[0].toUpperCase()}".`);

  return hints;
}
