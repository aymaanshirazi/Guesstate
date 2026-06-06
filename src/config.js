/* ----------------------------------------------------------------------------
 * Questate configuration — edit these once you've set up your accounts.
 * -------------------------------------------------------------------------- */

export const APP_NAME = "Questate";

// Your Ko-fi page (tips / "buy me a coffee"). Rename your Ko-fi page handle to
// match, or change this to whatever handle you end up with.
export const KOFI_URL = "https://ko-fi.com/questate";

// The Ko-fi SHOP item where people buy the Cities-mode unlock ($2.99 one-time).
export const KOFI_SHOP_URL = "https://ko-fi.com/s/cc2ec980b2";

export const PRO_PRICE = "$2.99";

// Your live game URL, used in the Daily share text (e.g. "https://questate.app").
// Leave "" until you've deployed; the share text will just omit the link.
export const SITE_URL = "";

/* Valid unlock codes for Cities (Pro). Anyone who buys gets one of these.
 * NOTE: this is a client-side gate — convenient, not piracy-proof. Fine for a
 * low-price casual unlock. To rotate codes, just edit this list and redeploy.
 *
 * "TEST-QUESTATE" is your private testing bypass; keep it or remove it anytime. */
export const VALID_PRO_CODES = [
  "TEST-QUESTATE",    // <-- your testing bypass code
  "QUESTATE-1CITIES", // <-- the real code buyers receive (must match the Ko-fi unlock file)
];

// localStorage key that remembers a successful unlock on this device.
export const PRO_STORAGE_KEY = "questate_pro_v1";
