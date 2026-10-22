# Bengaluru Trip Shuffler

Shuffle a complete trip plan from Bengaluru that fits inside **₹25,000 per person**: return travel, stay, food, local transport, sights and a buffer, with a day-by-day plan and tips.

## Features
- Filters: vibe, days available, travel mode (bus, train, flight, **car**, **bike**), Backpacker/Comfort style, group size, in-season only, skip places you've visited
- Switch any trip between its public transport, self-drive car and bike; costs update (car ≈ ₹8.5/km fuel + tolls, up to 5 per car; bike ≈ ₹3.5/km, 2 per bike)
- **World travel map**: search any place on Earth or tap the map and mark it visited. Shuffler trips appear as dots, the current trip is drawn from Bengaluru, and visited places are counted by place, country and shuffler trip
- Slot-machine style shuffle (respects `prefers-reduced-motion`); press **Space** or **S** to shuffle
- Per-person cost ledger, budget meter and group total
- Copy the plan as text, or copy a share link (filters + trip are kept in the URL)
- Filters and visited places are remembered in your browser; recent picks are one click away
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
- `app.js` – filtering, costing (incl. car/bike), shuffle, sharing and visited places
- `map.js` – world map, place search and tap-to-mark
- `vendor/leaflet/` – Leaflet 1.9.4 map library (BSD-2-Clause)

The map uses OpenStreetMap tiles and the Nominatim place search, so it needs an internet connection.

Prices are 2026 per-person estimates and will vary with dates and booking lead time.
