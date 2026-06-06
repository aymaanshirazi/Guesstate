/* Curated major cities for Cities mode. {name, country, lat, lng}.
 * Names are unique within this set (no cross-country collisions) so a typed
 * city resolves unambiguously. Add more countries/cities freely. */
export const CITIES = [
  // United States
  { name: "New York", country: "USA", lat: 40.71, lng: -74.01 },
  { name: "Los Angeles", country: "USA", lat: 34.05, lng: -118.24 },
  { name: "Chicago", country: "USA", lat: 41.88, lng: -87.63 },
  { name: "Houston", country: "USA", lat: 29.76, lng: -95.37 },
  { name: "Phoenix", country: "USA", lat: 33.45, lng: -112.07 },
  { name: "Philadelphia", country: "USA", lat: 39.95, lng: -75.17 },
  { name: "San Diego", country: "USA", lat: 32.72, lng: -117.16 },
  { name: "Dallas", country: "USA", lat: 32.78, lng: -96.80 },
  { name: "San Francisco", country: "USA", lat: 37.77, lng: -122.42 },
  { name: "Seattle", country: "USA", lat: 47.61, lng: -122.33 },
  { name: "Denver", country: "USA", lat: 39.74, lng: -104.99 },
  { name: "Boston", country: "USA", lat: 42.36, lng: -71.06 },
  { name: "Miami", country: "USA", lat: 25.76, lng: -80.19 },
  { name: "Atlanta", country: "USA", lat: 33.75, lng: -84.39 },
  { name: "Washington", country: "USA", lat: 38.91, lng: -77.04 },
  { name: "Las Vegas", country: "USA", lat: 36.17, lng: -115.14 },

  // Canada
  { name: "Toronto", country: "Canada", lat: 43.65, lng: -79.38 },
  { name: "Montreal", country: "Canada", lat: 45.50, lng: -73.57 },
  { name: "Vancouver", country: "Canada", lat: 49.28, lng: -123.12 },
  { name: "Calgary", country: "Canada", lat: 51.05, lng: -114.07 },
  { name: "Edmonton", country: "Canada", lat: 53.55, lng: -113.49 },
  { name: "Ottawa", country: "Canada", lat: 45.42, lng: -75.70 },
  { name: "Winnipeg", country: "Canada", lat: 49.90, lng: -97.14 },
  { name: "Quebec City", country: "Canada", lat: 46.81, lng: -71.21 },
  { name: "Halifax", country: "Canada", lat: 44.65, lng: -63.58 },
  { name: "Victoria", country: "Canada", lat: 48.43, lng: -123.37 },

  // United Kingdom
  { name: "London", country: "UK", lat: 51.51, lng: -0.13 },
  { name: "Birmingham", country: "UK", lat: 52.49, lng: -1.89 },
  { name: "Manchester", country: "UK", lat: 53.48, lng: -2.24 },
  { name: "Glasgow", country: "UK", lat: 55.86, lng: -4.25 },
  { name: "Liverpool", country: "UK", lat: 53.41, lng: -2.99 },
  { name: "Leeds", country: "UK", lat: 53.80, lng: -1.55 },
  { name: "Edinburgh", country: "UK", lat: 55.95, lng: -3.19 },
  { name: "Bristol", country: "UK", lat: 51.45, lng: -2.59 },
  { name: "Cardiff", country: "UK", lat: 51.48, lng: -3.18 },
  { name: "Belfast", country: "UK", lat: 54.60, lng: -5.93 },
  { name: "Newcastle", country: "UK", lat: 54.98, lng: -1.61 },

  // Spain
  { name: "Madrid", country: "Spain", lat: 40.42, lng: -3.70 },
  { name: "Barcelona", country: "Spain", lat: 41.39, lng: 2.17 },
  { name: "Valencia", country: "Spain", lat: 39.47, lng: -0.38 },
  { name: "Seville", country: "Spain", lat: 37.39, lng: -5.99 },
  { name: "Zaragoza", country: "Spain", lat: 41.65, lng: -0.89 },
  { name: "Malaga", country: "Spain", lat: 36.72, lng: -4.42 },
  { name: "Bilbao", country: "Spain", lat: 43.26, lng: -2.93 },
  { name: "Granada", country: "Spain", lat: 37.18, lng: -3.60 },
  { name: "Alicante", country: "Spain", lat: 38.35, lng: -0.48 },
  { name: "Palma", country: "Spain", lat: 39.57, lng: 2.65 },

  // France
  { name: "Paris", country: "France", lat: 48.85, lng: 2.35 },
  { name: "Marseille", country: "France", lat: 43.30, lng: 5.37 },
  { name: "Lyon", country: "France", lat: 45.76, lng: 4.84 },
  { name: "Toulouse", country: "France", lat: 43.60, lng: 1.44 },
  { name: "Nice", country: "France", lat: 43.70, lng: 7.27 },
  { name: "Nantes", country: "France", lat: 47.22, lng: -1.55 },
  { name: "Strasbourg", country: "France", lat: 48.57, lng: 7.75 },
  { name: "Bordeaux", country: "France", lat: 44.84, lng: -0.58 },
  { name: "Lille", country: "France", lat: 50.63, lng: 3.07 },

  // Germany
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.40 },
  { name: "Hamburg", country: "Germany", lat: 53.55, lng: 9.99 },
  { name: "Munich", country: "Germany", lat: 48.14, lng: 11.58 },
  { name: "Cologne", country: "Germany", lat: 50.94, lng: 6.96 },
  { name: "Frankfurt", country: "Germany", lat: 50.11, lng: 8.68 },
  { name: "Stuttgart", country: "Germany", lat: 48.78, lng: 9.18 },
  { name: "Dusseldorf", country: "Germany", lat: 51.23, lng: 6.78 },
  { name: "Dortmund", country: "Germany", lat: 51.51, lng: 7.47 },
  { name: "Leipzig", country: "Germany", lat: 51.34, lng: 12.37 },
];

// Alternate names / abbreviations -> canonical city name above.
export const CITY_ALIASES = {
  "nyc": "New York",
  "new york city": "New York",
  "la": "Los Angeles",
  "sf": "San Francisco",
  "san fran": "San Francisco",
  "frisco": "San Francisco",
  "vegas": "Las Vegas",
  "dc": "Washington",
  "washington dc": "Washington",
  "philly": "Philadelphia",
  "quebec": "Quebec City",
  "munchen": "Munich",
  "koln": "Cologne",
  "sevilla": "Seville",
  "saragossa": "Zaragoza",
};
