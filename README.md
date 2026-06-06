# Questate — a globe-guessing quest 🌍

A clean, futuristic geography-guessing game. A secret place is
hidden on the globe; you type guesses and each one lights up on an interactive
3D globe, colored by how close it is (cold blue → hot red) with the exact
distance in km. Keep guessing until you land on it.

From the **start menu** you pick what to guess (Countries, or Cities within a
chosen country) and the difficulty — settings lock for the round so nothing
resets mid-game. Inspired by *Globle*, with a GitHub-style globe.

## Pro (Cities mode)
Cities mode is a one-time **$2.99** unlock, sold via Ko-fi Shop. The gate is in
`src/config.js`:
- `KOFI_URL` / `KOFI_SHOP_URL` — your Ko-fi page + shop item link
- `VALID_PRO_CODES` — unlock codes you hand to buyers. **`TEST-QUESTATE`** is your
  testing bypass; enter it in the unlock modal to unlock without paying.
- Unlock is remembered in `localStorage` (`questate_pro_v1`). Note: client-side
  only, so it's convenient but not piracy-proof — fine for a low-price unlock.

## Play
```bash
npm install
npm run dev      # open the printed http://localhost:5173
```

## Build / deploy
```bash
npm run build    # outputs static site to dist/
npm run preview  # preview the production build locally
```
`dist/` is a plain static site — drop it on Vercel, Netlify, GitHub Pages, etc.

## Features
- **Interactive 3D globe** (globe.gl / three.js) — drag to rotate, auto-rotates
  until your first guess, then flies to each country you name.
- **Heat feedback** — guessed countries glow from cold (far) to hot (near).
- **Closest panel + sorted guess feed** with exact distances.
- **Easy vs Hard mode** — Easy shows a direction arrow + compass bearing to the
  target; Hard hides the direction.
- **Smart "Did you mean?"** — close typos (e.g. `canara` → Canada) prompt a
  confirmation; real non-country words (e.g. `kerala`) and gibberish are *not*
  auto-corrected and **cost no turn** ("check the spelling").
- **Aliases** — `USA`, `America`, `UK`, `Holland`, `Burma`, etc. all resolve.
- **Funny hints** — a 💡 button reveals progressive, light-hearted hints (vague →
  specific), ending with the first letter as a last resort.
- **Give up** — 🏳️ reveals the answer on the globe with a cheeky message.
- **Countries / Cities modes** — chosen in the start menu. Cities mode guesses
  major cities within ONE chosen country (USA, Canada, UK, Spain, France,
  Germany). Add more in `src/cities.js`.
- **Daily Challenge** — one seeded country, the same for everyone each day, with
  a Wordle-style shareable emoji result grid. Set `SITE_URL` in `src/config.js`
  to include your link in the share text.

## Project layout
- `index.html` — markup / HUD
- `src/style.css` — all styling
- `src/main.js` — globe rendering + game logic (distance, heat, matching)
- `src/aliases.js` — alternate country names
- `public/countries.geojson` — Natural Earth country borders (bundled, offline)

## Monetization
- **Buy Me a Coffee** button lives in the header. Edit `index.html`, find
  `buymeacoffee.com/YOUR_USERNAME`, and replace `YOUR_USERNAME` with your handle.

## Analytics
- A commented-out **Cloudflare Web Analytics** snippet sits at the bottom of
  `index.html`. Add your token and remove the `<!-- -->` markers to enable free
  traffic stats. (Netlify's own Analytics is a paid add-on.)

## Notes
- Typing **Israel** quietly resolves to **Palestine** and the whole region
  renders as one (see `MERGE_INTO` in `src/main.js` and the aliases in
  `src/aliases.js`).

## Tuning knobs (in `src/main.js`)
- `MAX_REF_KM` — distance that maps to "ice cold" on the heat scale.
- `resolveGuess()` — typo thresholds (`allow`, length/ratio limits, ambiguity).
