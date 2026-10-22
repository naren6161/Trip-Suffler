// World map of visited places (Leaflet + OpenStreetMap tiles, place search via Nominatim).
const TravelMap = (()=>{
  const GEO = "https://nominatim.openstreetmap.org";
  let map = null, tripLayer, visitLayer, routeLayer;
  let pending = {};                              // places offered in popups / search results, keyed for buttons

  function init(){
    const el = $("map");
    if (!window.L){
      el.innerHTML = `<div class="empty">The map couldn't load. Your visited list below still works.</div>`;
      return;
    }
    map = L.map(el, {worldCopyJump:true, scrollWheelZoom:false, zoomSnap:0.5}).setView([HOME.lat, HOME.lng], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:18, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    tripLayer = L.layerGroup().addTo(map);
    visitLayer = L.layerGroup().addTo(map);
    map.on("click", onMapClick);
    map.on("focus", ()=>map.scrollWheelZoom.enable());
    map.on("blur", ()=>map.scrollWheelZoom.disable());
    el.addEventListener("click", onPopupClick);
    refresh();
    fitAll();
  }

  function dot(latlng, cls, radius){
    return L.circleMarker(latlng, {radius, className:cls, weight:2});
  }

  function refresh(){
    if (!map) return;
    tripLayer.clearLayers(); visitLayer.clearLayers(); routeLayer.clearLayers(); pending = {};

    dot([HOME.lat, HOME.lng], "mk-home", 7).bindTooltip("Home: Bengaluru").addTo(tripLayer);

    const cur = state.current;
    if (cur){
      L.polyline([[HOME.lat, HOME.lng], [cur.lat, cur.lng]], {className:"mk-route", weight:2.5, dashArray:"6 6"}).addTo(routeLayer);
    }
    for (const t of TRIPS){
      if (visitFor(t)) continue;                 // visited trips are drawn with the visited layer
      const isCur = cur && cur.id === t.id;
      dot([t.lat, t.lng], isCur ? "mk-current" : "mk-trip", isCur ? 8 : 5)
        .bindTooltip(t.name)
        .bindPopup(tripPopup(t))
        .addTo(tripLayer);
    }
    for (const v of visited){
      const t = v.tripId && TRIPS.find(x=>x.id===v.tripId);
      dot([v.lat, v.lng], cur && t && cur.id === t.id ? "mk-visited mk-current-v" : "mk-visited", 7)
        .bindTooltip(`✓ ${esc(v.name)}`)
        .bindPopup(`<b>${esc(v.name)}</b><br><small>${esc([v.country, "visited " + v.at].filter(Boolean).join(" · "))}</small>
          <div class="pop-act">${t ? `<button type="button" class="btn sm" data-pop="trip" data-id="${t.id}">Open trip</button>` : ""}
          <button type="button" class="btn sm" data-pop="remove" data-id="${v.id}">Remove</button></div>`)
        .addTo(visitLayer);
    }
  }

  function tripPopup(t){
    const c = costsFor(t);
    return `<b>${esc(t.name)}</b><br><small>${t.days}D/${t.nights}N · ${inr(c.total)} per head by ${MODE_NAME[c.mode].toLowerCase()}</small>
      <div class="pop-act"><button type="button" class="btn sm" data-pop="trip" data-id="${t.id}">Open trip</button>
      <button type="button" class="btn sm" data-pop="visit-trip" data-id="${t.id}">Mark visited</button></div>`;
  }

  function placePopupHtml(key, p){
    return `<b>${esc(p.name)}</b>${p.detail?`<br><small>${esc(p.detail)}</small>`:""}
      <div class="pop-act"><button type="button" class="btn sm" data-pop="visit-place" data-key="${key}">Mark visited</button></div>`;
  }

  function onPopupClick(e){
    const b = e.target.closest("button[data-pop]"); if (!b) return;
    L.DomEvent.stopPropagation(e);
    const act = b.dataset.pop;
    if (act === "trip"){
      const t = TRIPS.find(x=>x.id===b.dataset.id); if (!t) return;
      spinToken++; setCurrent(t);
      state.history = [t.id, ...state.history.filter(x=>x!==t.id)].slice(0,6);
      renderTicket(t,true); renderHistory(); renderControls(); syncHash(); refresh();
      $("ticket").scrollIntoView({behavior:"smooth", block:"start"});
    } else if (act === "visit-trip"){
      const t = TRIPS.find(x=>x.id===b.dataset.id); if (t && !visitFor(t)) toggleTripVisited(t);
      map.closePopup();
    } else if (act === "visit-place"){
      const p = pending[b.dataset.key]; if (!p) return;
      addVisited(p); map.closePopup();
    } else if (act === "remove"){
      removeVisited(b.dataset.id); map.closePopup();
    }
  }

  // Turn a Nominatim result into a short name, a detail line and a country.
  function toPlace(r){
    const a = r.address || {};
    const name = r.name || a.city || a.town || a.village || a.state || (r.display_name||"").split(",")[0] || "Dropped pin";
    const detail = (r.display_name || "").split(",").map(s=>s.trim()).filter(s=>s && s!==name).slice(0,3).join(", ");
    return {name, detail, country:a.country || "", lat:+r.lat, lng:+r.lon};
  }

  async function geo(path, params){
    const u = new URL(GEO + path);
    for (const [k,v] of Object.entries({format:"jsonv2", addressdetails:1, "accept-language":"en", ...params})) u.searchParams.set(k, v);
    const res = await fetch(u, {headers:{Accept:"application/json"}});
    if (!res.ok) throw new Error("lookup failed: " + res.status);
    return res.json();
  }

  async function onMapClick(e){
    const {lat, lng} = e.latlng.wrap();
    const pop = L.popup().setLatLng(e.latlng).setContent("Looking up this spot…").openOn(map);
    let p;
    try{
      const r = await geo("/reverse", {lat, lon:lng, zoom:10});
      p = r && !r.error ? toPlace(r) : null;
    }catch(err){ p = null; }
    if (!p) p = {name:`Pin at ${lat.toFixed(2)}, ${lng.toFixed(2)}`, detail:"Couldn't find a place name here", country:"", lat, lng};
    else { p.lat = lat; p.lng = lng; }         // keep the exact spot the user tapped
    const key = "c" + Date.now();
    pending[key] = p;
    if (map.hasLayer(pop)) pop.setContent(placePopupHtml(key, p));
  }

  async function search(q){
    const box = $("placeResults");
    box.hidden = false; box.innerHTML = `<p class="muted">Searching…</p>`;
    let rows;
    try{ rows = await geo("/search", {q, limit:6}); }
    catch(err){ box.innerHTML = `<p class="muted">Search isn't reachable right now. You can still tap the map to mark a spot.</p>`; return; }
    if (!rows.length){ box.innerHTML = `<p class="muted">No places found for “${esc(q)}”.</p>`; return; }
    const results = rows.map(toPlace);
    box.innerHTML = `<ul>${results.map((p,i)=>{
      pending["s"+i] = p;
      return `<li><span class="vname">${esc(p.name)}<small>${esc(p.detail)}</small></span>
        <span class="vact"><button type="button" class="btn sm" data-res="show" data-key="s${i}">Show</button>
        <button type="button" class="btn sm" data-res="visit" data-key="s${i}">Mark visited</button></span></li>`;
    }).join("")}</ul>`;
  }

  $("placeForm").addEventListener("submit", e=>{
    e.preventDefault();
    const q = $("placeInput").value.trim(); if (q) search(q);
  });
  $("placeResults").addEventListener("click", e=>{
    const b = e.target.closest("button[data-res]"); if (!b) return;
    const p = pending[b.dataset.key]; if (!p) return;
    if (b.dataset.res === "visit"){
      addVisited(p);
      $("placeResults").hidden = true; $("placeInput").value = "";
      focusPlace(p);
    } else if (map){
      map.flyTo([p.lat, p.lng], 9);
      const key = b.dataset.key;
      L.popup().setLatLng([p.lat, p.lng]).setContent(placePopupHtml(key, p)).openOn(map);
    }
  });

  function fitAll(){
    if (!map) return;
    const pts = [[HOME.lat, HOME.lng], ...TRIPS.map(t=>[t.lat,t.lng]), ...visited.map(v=>[v.lat,v.lng])];
    map.fitBounds(L.latLngBounds(pts).pad(0.15), {maxZoom:7});
  }
  function focusPlace(p){
    if (!map) return;
    $("map").scrollIntoView({behavior:"smooth", block:"center"});
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 8));
  }
  function focusTrip(t){
    if (!map) return;
    $("map").scrollIntoView({behavior:"smooth", block:"center"});
    map.flyToBounds(L.latLngBounds([[HOME.lat, HOME.lng], [t.lat, t.lng]]).pad(0.4), {maxZoom:9});
  }

  init();
  return {refresh, focusPlace, focusTrip};
})();
window.TravelMap = TravelMap;                    // app.js checks window.TravelMap before calling in
