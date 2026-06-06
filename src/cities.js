/* Cities mode now loads a real city database from public/cities.json (GeoNames,
 * towns with population > 15,000), so thousands of real cities are recognized as
 * guesses. The ANSWER is still limited to well-known cities (see target pool in
 * main.js). This file only holds friendly aliases -> the dataset's exact names. */

export const CITY_ALIASES = {
  // United States
  "nyc": "New York City",
  "new york": "New York City",
  "la": "Los Angeles",
  "sf": "San Francisco",
  "san fran": "San Francisco",
  "frisco": "San Francisco",
  "vegas": "Las Vegas",
  "dc": "Washington",
  "washington dc": "Washington",
  "philly": "Philadelphia",
  // Germany
  "munchen": "Munich",
  "cologne": "Köln",
  // Spain
  "seville": "Sevilla",
  "saragossa": "Zaragoza",
  // (Québec, Montréal, etc. already match because accents are stripped on input)
};
