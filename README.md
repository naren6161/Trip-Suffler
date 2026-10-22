# Bengaluru Trip Shuffler

Shuffle a complete trip plan from Bengaluru that fits inside **₹25,000 per person**: return travel, stay, food, local transport, sights and a buffer, with a day-by-day plan and tips.

## Features
- Filters: vibe, days available, travel mode, Backpacker/Comfort style, group size, in-season only
- Slot-machine style shuffle (respects `prefers-reduced-motion`); press **Space** or **S** to shuffle
- Per-person cost ledger, budget meter and group total
- Copy the plan as text, or copy a share link (filters + trip are kept in the URL)
- Filters are remembered in your browser; recent picks are one click away
- Light and dark mode, works on phones

## Run it
No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

It can be hosted as-is on GitHub Pages (Settings → Pages → deploy from branch).

## Files
- `index.html` – page markup
- `styles.css` – styles
- `trips.js` – trip catalogue (edit here to add destinations)
- `app.js` – filtering, costing, shuffle and sharing logic

Prices are 2026 per-person estimates and will vary with dates and booking lead time.
