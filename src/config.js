/* ----------------------------------------------------------------------------
 * Guesstate configuration — edit these once you've set up your accounts.
 * -------------------------------------------------------------------------- */

export const APP_NAME = "Guesstate";

// Your Ko-fi page (tips / "buy me a coffee"). Rename your Ko-fi page handle to
// match, or change this to whatever handle you end up with.
export const KOFI_URL = "https://ko-fi.com/guesstate";

// The Ko-fi SHOP item where people buy the Cities-mode unlock ($2.99 one-time).
export const KOFI_SHOP_URL = "https://ko-fi.com/s/cc2ec980b2";

export const PRO_PRICE = "$2.99";
// Background music is generated in-browser (see lofi engine in main.js) — no audio
// files and no copyright concerns. Moods are defined there.

// Your live game URL, used in the Daily share text.
export const SITE_URL = "https://guesstate.com";

// Multiplayer (PartyKit) server host. In dev it's local; in production it's the
// deployed party (run `npx partykit deploy` to update the server).
export const PARTY_HOST = import.meta.env.DEV
  ? "127.0.0.1:1999"
  : "guesstate.aymaanshirazi.partykit.dev";
// Multiplayer button only shows when a host is configured (so prod stays hidden
// until the party is deployed).
export const MULTIPLAYER_ENABLED = !!PARTY_HOST;

/* Valid unlock codes for Cities (Pro). Anyone who buys gets one of these.
 * NOTE: this is a client-side gate — convenient, not piracy-proof. Fine for a
 * low-price casual unlock. To rotate codes, just edit this list and redeploy.
 *
 * "TEST-GUESSTATE" is your private testing bypass; keep it or remove it anytime.
 * The buyer code below must EXACTLY match the code in the Ko-fi unlock file. */
export const VALID_PRO_CODES = [
  "TEST-GUESSTATE",         // <-- your private testing bypass code
  "GUESSTATE-CITIES-K7Q9",  // <-- the real code buyers receive (less guessable)
];

// localStorage key that remembers a successful unlock on this device.
export const PRO_STORAGE_KEY = "guesstate_pro_v1";
